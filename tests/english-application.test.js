// Content-only checks: no session progression or five-minute simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
import {buildCatalog,selectQuestions,matchesPracticeQuestion,sectionKey} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,buildPriorityIndex,priorityCategory,createAdaptivePicker,PRIORITY_WEIGHTS} from '../progress.js';
const read=n=>JSON.parse(readFileSync(new URL(`../quiz-data/${n}.json`,import.meta.url)));
const items=read('junior_english_application'),prior=['junior_english','junior_expansion','junior_english_core','junior_english_extended'].flatMap(read).filter(q=>q.subject==='英語');
const queue=makeQuestionQueue(items,()=>.5);
test('application bank contains 68 grammar and 40 reading points without duplicating previous prompts',()=>{
 assert.equal(items.length,108);assert.equal(items.filter(q=>q.field==='英文法').length,68);assert.equal(items.filter(q=>q.field==='英文読解').length,40);
 assert.equal(new Set([...prior,...items].map(q=>q.id)).size,prior.length+items.length);
 const prompts=new Set(prior.map(q=>q.prompt).filter(Boolean));
 for(const item of items){assert.ok(!prompts.has(item.prompt),item.id);assert.ok(item.note.length>10);assert.equal(item.kind,'choice');}
 assert.equal(queue.length,108);
 for(const q of queue){assert.equal(q.mode,'learning_point');assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.choices.every(s=>[...s].length<=30),q.id);assert.ok([...q.prompt+q.task+q.choices.join('')].length<=200,q.id);}
});
test('new points filter by grade, unit and grammar or reading without cross-contamination',()=>{
 const all=[...prior,...items],catalog=buildCatalog(all);
 for(const item of items){const type=item.field==='英文法'?'grammar':'reading';const selection={id:`中学:英語:${item.grade.at(-1)}`,practiceType:type,sections:[sectionKey(item)]};const chosen=selectQuestions(all,'中学',selection,catalog);assert.ok(chosen.some(q=>q.id===item.id));assert.ok(chosen.every(q=>q.grade===item.grade&&q.field===item.field));assert.ok(makeQuestionQueue(chosen,()=>.5,q=>matchesPracticeQuestion(q,type)).length);}
});
test('new answer history survives reload and lowers priority after three first-try successes',()=>{
 let state=normalizeHistory(null);const q=queue[0];
 for(let i=0;i<3;i++)state=recordAnswer(state,q,{correct:true,chosen:q.answer,attempt:'attempt'+i,time:i+1});
 state=normalizeHistory(JSON.parse(JSON.stringify(state)));assert.equal(state.questions[questionKey(q)].answerCount,3);assert.equal(priorityCategory(q,buildPriorityIndex(state)),6);
 state=recordAnswer(state,q,{correct:false,chosen:q.choices.find(c=>c!==q.answer),attempt:'forgotten',time:4});assert.equal(priorityCategory(q,buildPriorityIndex(state)),4);
});
test('many unseen candidates do not dilute category probability; same-play successes never repeat while fresh candidates exist',()=>{
 assert.deepEqual(PRIORITY_WEIGHTS,[35,25,18,15,5,2]);
 const base=queue[0],unseen=Array.from({length:1000},(_,i)=>({...base,sourceId:'new'+i}));
 const old=Array.from({length:5},(_,i)=>({...base,sourceId:'old'+i}));
 let state=normalizeHistory(null);for(const q of old)state=recordAnswer(state,q,{correct:true,attempt:q.sourceId,time:1});
 // With categories 1 and 5 available, 5/(35+5)=12.5%, regardless of bank size.
 const pick=createAdaptivePicker([...unseen,...old],()=>state,()=>.9,()=>[]);assert.ok(pick()[0].sourceId.startsWith('old'));
 const results=[],draw=createAdaptivePicker([...unseen,...old],()=>state,()=>.9,()=>results),seen=new Set();
 for(let i=0;i<40;i++){const q=draw()[0];assert.ok(!seen.has(questionKey(q)));seen.add(questionKey(q));results.push({question:q,correct:true,wrong:0});}
});
