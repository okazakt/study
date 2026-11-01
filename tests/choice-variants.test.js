// Authored content and per-question selection/history only, no whole-session simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {choicePresentations,materializeChoiceItem,normalizePatternUsage} from '../choice-variants.js';
import {makeQuestionQueue,makeChoiceQuestion,seededRandom,Game} from '../game.js';
import {normalizeHistory,recordAnswer,questionKey,createAdaptivePicker,priorityCategory,buildPriorityIndex,questionCoverage} from '../progress.js';
const items=JSON.parse(readFileSync(new URL('../quiz-data/junior_english_application.json',import.meta.url)));
const varied=items.filter(q=>q.presentations?.length);
test('80 learning points have 160 authored contexts without doubling their question identities',()=>{
 assert.equal(items.length,108);assert.equal(varied.length,80);assert.equal(varied.flatMap(choicePresentations).length,160);
 assert.equal(items.filter(q=>q.content_batch==='english-application-2').length,48);
 assert.equal(makeQuestionQueue(items,()=>.5).length,108);
 const prompts=new Set();for(const item of varied)for(const p of choicePresentations(item)){
  assert.ok(!prompts.has(p.prompt),p.prompt);prompts.add(p.prompt);
  assert.equal(new Set([p.answer,...p.dummies]).size,4,item.id);
  assert.ok([p.answer,...p.dummies].every(s=>typeof s==='string'&&s.length&&[...s].length<=30),item.id);
  assert.ok([...p.prompt+item.task+p.answer+p.dummies.join('')].length<=200,item.id);
 }
});
test('different presentations change content but share source ID, answer count and coverage',()=>{
 const item=varied.find(q=>q.learning_point==='look_adjective'),a=makeChoiceQuestion(item,()=>0),b=makeChoiceQuestion(item,()=>.99);
 assert.notEqual(a.prompt,b.prompt);assert.notEqual(a.answer,b.answer);assert.equal(questionKey(a),questionKey(b));
 let history=normalizeHistory(null);for(const [i,q] of [a,b].entries())history=recordAnswer(history,q,{correct:true,attempt:'attempt'+i,time:i+1});
 const row=history.questions[questionKey(a)];assert.equal(row.answerCount,2);assert.equal(row.first,2);assert.deepEqual(questionCoverage([a,b],history),{total:1,solved:1});
 assert.equal(row.patternUsage.base.count,1);assert.equal(row.patternUsage['context-2'].count,1);
});
test('unused contexts win; equal usage favors oldest and exact ties randomize',()=>{
 const item=varied[0],a=materializeChoiceItem(item,()=>0),b=materializeChoiceItem(item,()=>.99);
 assert.equal(a.variant.parameters.pattern,'base');assert.equal(b.variant.parameters.pattern,'context-2');
 assert.equal(materializeChoiceItem(item,()=>0,{base:{count:1,lastAt:1}}).variant.parameters.pattern,'context-2');
 assert.equal(materializeChoiceItem(item,()=>0,{base:{count:1,lastAt:10},'context-2':{count:1,lastAt:1}}).variant.parameters.pattern,'context-2');
 assert.notEqual(materializeChoiceItem(a,()=>0,{},a.variant.signature).variant.signature,a.variant.signature);
});
test('live picker avoids last context, preserves chosen text during retries and records exact explanation',()=>{
 const item=varied[0],q=makeChoiceQuestion(item,()=>0);let history=normalizeHistory(null);
 const draw=createAdaptivePicker([q],()=>history,()=>0),first=draw()[0];
 history=recordAnswer(history,first,{correct:false,chosen:first.choices.find(s=>s!==first.answer),attempt:'one',time:1});
 history=recordAnswer(history,first,{correct:true,chosen:first.answer,wrongBefore:1,attempt:'one',time:2});
 const row=history.questions[questionKey(first)];assert.equal(row.answerCount,1);assert.equal(row.patternUsage.base.count,1);assert.equal(row.patternUsage.base.lastAt,2);
 assert.deepEqual(row.presentation,{prompt:first.prompt,choices:first.choices,note:first.note});
 const second=draw()[0];assert.notEqual(second.variant.signature,first.variant.signature);assert.equal(second.choices[second.correct],second.answer);
 assert.equal(first.prompt,row.presentation.prompt);assert.equal(first.note,row.presentation.note);
});
test('old histories treat former fixed text as base and do not reset mastery or school scope',()=>{
 const item=varied[0],q=makeChoiceQuestion({...item,presentations:undefined},()=>0);let history=normalizeHistory(null);
 for(let i=0;i<3;i++)history=recordAnswer(history,q,{correct:true,attempt:'old'+i,time:i+1});
 const normalized=normalizeHistory(JSON.parse(JSON.stringify(history)));
 const next=createAdaptivePicker([makeChoiceQuestion(item,()=>0)],()=>normalized,()=>0)()[0];assert.equal(next.variant.parameters.pattern,'context-2');
 assert.equal(priorityCategory(next,buildPriorityIndex(normalized)),6);
 history=recordAnswer(normalized,next,{correct:true,attempt:'new',time:4});
 assert.equal(history.questions[questionKey(q)].patternUsage.base.count,3);
 assert.equal(history.questions[questionKey(q)].patternUsage['context-2'].count,1);
 assert.equal(history.questions[questionKey(q)].answerCount,4);
});
test('restored history preserves pattern usage and displayed snapshot without mutating source data',()=>{
 const item=varied[0],source=JSON.stringify(item),q=makeChoiceQuestion(item,()=>.99);
 let state=recordAnswer(normalizeHistory(null),q,{correct:true,attempt:'one',time:5});state=normalizeHistory(JSON.parse(JSON.stringify(state)));
 assert.equal(state.questions[questionKey(q)].patternUsage['context-2'].count,1);
 assert.deepEqual(state.events[0].presentation,{prompt:q.prompt,choices:q.choices,note:q.note});assert.equal(JSON.stringify(item),source);
 assert.deepEqual(normalizePatternUsage({bad:{count:-1,lastAt:0},ok:{count:1,lastAt:2}}),{ok:{count:1,lastAt:2}});
});
test('same seeded history produces the same authored contexts for reference and actual selection',()=>{
 const queue=makeQuestionQueue(varied,()=>.5),run=()=>{const random=seededRandom(52);let history=normalizeHistory(null);const draw=createAdaptivePicker(queue,()=>history,random);return Array.from({length:200},(_,i)=>{const q=draw()[0];history=recordAnswer(history,q,{correct:true,chosen:q.answer,attempt:'answer'+i,time:i+1});return [q.sourceId,q.variant.signature,q.prompt,q.answer,q.choices]});};assert.deepEqual(run(),run());
});
test('question end admission uses the selected presentation length without rerolling its answer',()=>{
 const q=makeChoiceQuestion(varied[0],()=>.99),signature=q.variant.signature;
 const events=Array.from({length:600},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,type:'beat'}));
 const game=new Game([],events,0,()=>.5,300,()=>true,()=>[structuredClone(q)]);
 assert.equal(game.question.variant.signature,signature);assert.equal(game.question.prompt,q.prompt);assert.equal(game.question.answer,q.answer);
 // Isolated admission calculation, not a five-minute progress run.
 assert.ok(Number.isFinite(game.earliestCompletion(0)));assert.equal(game.question.variant.signature,signature);
});
