import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,makeQuestionQueue,makeChoiceQuestion,makeSpellingQuestions} from '../game.js';
import {buildCatalog,selectQuestions,matchesPracticeQuestion,choiceColumns} from '../learning.js';
import {normalizeHistory,recordAnswer,questionCoverage,createAdaptivePicker,questionKey} from '../progress.js';
import {simulateSession} from '../scripts/simulate-session.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../quiz-data/${name}.json`,import.meta.url)));
const added=read('junior_expansion');
const items=['junior_japanese','junior_english','junior_math','junior_science','junior_social'].flatMap(read).concat(added);
const catalog=buildCatalog(items);
test('expansion enables all fifteen middle-school courses without replacing existing identifiers',()=>{
 assert.equal(added.length,206);assert.equal(new Set(items.map(q=>q.id)).size,items.length);
 assert.equal(new Set(items.filter(q=>q.english).map(q=>q.english)).size,items.filter(q=>q.english).length);
 assert.equal(new Set(items.filter(q=>q.kind==='idiom').map(q=>q.term)).size,items.filter(q=>q.kind==='idiom').length);
 assert.equal(new Set(items.filter(q=>q.character).map(q=>q.character)).size,items.filter(q=>q.character).length);
 for(const subject of ['国語','英語','数学','理科','社会'])for(const grade of [1,2,3]){
  const c=catalog.find(c=>c.id===`中学:${subject}:${grade}`);assert.ok(c.count>0,c.id);
  const selected=selectQuestions(items,'中学',{id:c.id,sections:null},catalog);
  assert.ok(selected.every(q=>q.grade===`中${grade}`&&q.subject===subject));
  for(const section of c.sections){
   const part=selectQuestions(items,'中学',{id:c.id,sections:[section.key]},catalog);
   assert.equal(part.length,section.count);assert.ok(makeQuestionQueue(part).length>0);
  }
 }
 assert.ok(catalog.filter(c=>c.school==='高校').every(c=>c.count===0));
});
test('every new answer is unique, short enough and every spelling reconstructs its word unambiguously',()=>{
 for(const q of makeQuestionQueue(added,()=>.5)){
  assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices).size,4,q.id);
  assert.equal(q.choices[q.correct],q.answer,q.id);assert.ok(q.prompt&&!q.prompt.includes('{{'),q.id);
  assert.ok(q.note!==undefined);assert.ok(q.choices.every(c=>typeof c==='string'&&c.length>0));
  assert.ok(q.choices.every(c=>Array.from(c).length<=30),q.id);
  assert.ok(Array.from(q.prompt+q.task+q.choices.join('')).length<=200,q.id);
 }
 for(const item of added.filter(i=>i.spelling)){
  assert.equal(item.spelling_template.replace(/\{\{(\d+)\}\}/g,(_,i)=>item.spelling[i-1].answer),item.english);
  let prefix='';for(const q of makeSpellingQuestions(item)){
   for(const c of q.choices){assert.equal(c.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(c),c===q.answer);}
   prefix+=q.answer;
  }
 }
});
test('procedure points are single-direction questions, including math, without answer-bearing context',()=>{
 const points=added.filter(i=>i.kind==='choice'),queue=makeQuestionQueue(points,()=>.5);
 assert.equal(queue.length,points.length);assert.ok(queue.every(q=>q.mode==='learning_point'&&q.context===''));
 for(const item of points){const q=makeChoiceQuestion(item,()=>.5);assert.equal(q.sourceId,item.id);assert.equal(q.reviewLabel,item.prompt);}
 assert.ok(makeQuestionQueue(items.filter(i=>i.subject==='数学')).every(q=>q.mode!=='explanation_to_term'));
});
test('English grammar and Japanese reading filters do not leak into vocabulary or other practice',()=>{
 for(const subject of ['英語','国語'])for(const grade of [1,2,3]){
  const type=subject==='英語'?'grammar':'reading';
  const selected=selectQuestions(items,'中学',{id:`中学:${subject}:${grade}`,sections:null,practiceType:type},catalog);
  assert.ok(selected.length);assert.ok(makeQuestionQueue(selected).every(q=>matchesPracticeQuestion(q,type)));
 }
 for(const q of makeQuestionQueue(added.filter(i=>i.subject==='英語'&&i.kind==='choice')))
  for(const type of ['word_ja_en','word_en_ja','word_spelling','phrase_ja_en','phrase_en_ja'])assert.equal(matchesPracticeQuestion(q,type),false);
});
test('new choices retry, persist wrong and correct answers, and remain available for review and priority',()=>{
 const item=added.find(i=>i.kind==='choice');const g=new Game([item],[],0,()=>.5);
 const q=g.question;g.changePhase('answer',0);let time=2;
 for(const lane of [(q.correct+1)%4,q.correct]){
  for(let n=0;n<3;n++){time++;g.notes.push({target:time,lane,color:lane,done:false});g.tap(lane,time);}
 }
 assert.equal(g.wrongCount,1);assert.equal(g.correctCount,1);
 let history=normalizeHistory(null);
 history=recordAnswer(history,q,{correct:false,chosen:q.choices[(q.correct+1)%4],attempt:'one',time:1});
 history=recordAnswer(history,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'one',time:2});
 const row=normalizeHistory(JSON.parse(JSON.stringify(history))).questions[questionKey(q)];
 assert.equal(row.answerCount,1);assert.equal(row.wrong,1);assert.equal(row.correct,1);assert.equal(row.first,0);
 assert.equal(row.recent[0].wrongCount,1);assert.equal(questionCoverage([q],history).solved,1);
 assert.equal(createAdaptivePicker([q],()=>history,()=>.5)()[0].sourceId,item.id);
});
test('long answers use two columns while short formulas and kanji keep four',()=>{
 assert.equal(choiceColumns({choices:['a','b','c','d']}),4);
 assert.equal(choiceColumns({choices:['候補を代入して文脈を確かめる','b','c','d']}),2);
 assert.equal(choiceColumns({mode:'kanji_component',choices:['忄','木','氵','扌']}),4);
});
test('all expanded grade courses finish ideal five-minute play without interrupting a question',()=>{
 for(const c of catalog.filter(c=>c.school==='中学'&&c.year!=='exam')){
  const selected=selectQuestions(items,'中学',{id:c.id,sections:null},catalog);
  const result=simulateSession(selected,42);
  assert.equal(result.counted,120,c.id);assert.equal(result.taps,120,c.id);assert.equal(result.missed,0,c.id);assert.ok(result.answers>0,c.id);
 }
});
