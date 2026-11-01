import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeSpellingQuestions,makePhraseQuestions,makeEnglishQuestion,Game} from '../game.js';
import {buildCatalog,selectQuestions,matchesPracticeQuestion,practiceTypes,choiceColumns} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,questionCoverage,createAdaptivePicker} from '../progress.js';
import {simulateSession} from '../scripts/simulate-session.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../quiz-data/${name}.json`,import.meta.url)));
const core=read('junior_english_core');
const all=['junior_japanese','junior_english','junior_math','junior_science','junior_social','junior_expansion'].flatMap(read).concat(core,read('junior_english_vocabulary2'),read('junior_english_supplement'),read('junior_english_extended'),read('junior_english_application'));
const english=all.filter(q=>q.subject==='英語'),catalog=buildCatalog(all);
test('large English batch has stable unique identities and adds words phrases grammar and reading without duplicates',()=>{
 assert.equal(core.length,621);assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 assert.deepEqual(Object.fromEntries(['英単語','熟語','英文法','英文読解'].map(field=>[field,core.filter(q=>q.field===field).length])),{'英単語':505,'熟語':48,'英文法':60,'英文読解':8});
 const lexical=english.filter(q=>q.english);assert.equal(new Set(lexical.map(q=>q.english)).size,lexical.length);
 assert.equal(english.length,2922);assert.equal(makeQuestionQueue(english,()=>.5).length,10757);
});
test('all generated English choices are distinct and fit the established content budget',()=>{
 assert.equal(choiceColumns({choices:['Thursday','Monday','Friday','Sunday']}),2);
 assert.equal(choiceColumns({choices:['cat','dog','bird','fish']}),4);
 for(const q of makeQuestionQueue(core,()=>.5)){
  assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices).size,4,q.id);assert.equal(q.choices[q.correct],q.answer);
  assert.ok(q.prompt&&!q.prompt.includes('{{'),q.id);assert.ok(typeof q.note==='string',q.id);
  assert.ok(q.choices.every(s=>typeof s==='string'&&Array.from(s).length<=30),q.id);
  assert.ok(Array.from(q.prompt+q.task+q.choices.join('')).length<=200,q.id);
 }
});
test('every spelling reconstructs its word and each offered segment has one unambiguous correct prefix',()=>{
 for(const item of core.filter(q=>q.spelling)){
  const complete=item.spelling_template.replace(/\{\{(\d+)\}\}/g,(_,i)=>item.spelling[i-1].answer);assert.equal(complete,item.english);
  let prefix='';for(const q of makeSpellingQuestions(item)){
   for(const choice of q.choices){assert.equal(choice.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(choice),choice===q.answer,`${item.english}: ${choice}`);}
   prefix+=q.answer;
  }
 }
});
test('phrase targets match actual word positions and do not turn into character spelling questions',()=>{
 for(const item of core.filter(q=>q.phrase_blanks)){
  assert.equal(item.field,'熟語');assert.ok(!item.spelling);
  for(const q of makePhraseQuestions(item)){assert.equal(q.answer,item.english.split(' ')[q.blankIndex-1]);assert.ok(q.prompt.includes('？'));assert.equal(q.continuation,undefined);}
 }
 const getOn=core.find(q=>q.english==='get on');assert.ok(!getOn.phrase_blanks[0].dummies.includes('in'));
 const rightAway=core.find(q=>q.english==='right away');assert.ok(!rightAway.phrase_blanks[0].dummies.includes('now'));
 const covered=core.find(q=>q.english==='be covered with');assert.ok(!covered.phrase_blanks[0].dummies.includes('in'));
});
test('known overlapping translations are not offered against each other',()=>{
 for(const [a,b] of [['new','fresh'],['cold','cool'],['learn','study'],['skill','ability'],['reason','cause'],['reason','purpose'],['think','guess'],['know','understand'],['develop','improve'],['pay','spend'],['send','deliver'],['receive','collect'],['bill','receipt'],['need','want'],['study','work']]){
  for(const [target,other] of [[a,b],[b,a]]){
   const item=core.find(q=>q.english===target);if(item)assert.ok(!item.english_dummies.includes(other),`${target}: ${other}`);
  }
 }
 for(const item of core.filter(q=>q.english))for(const direction of ['to_japanese','to_english']){
  const q=makeEnglishQuestion(item,direction,()=>.5);assert.equal(q.sourceId,item.id);
 }
});
test('all English grades and eight practice choices filter the expanded bank without cross-category leakage',()=>{
 for(const grade of [1,2,3])for(const type of practiceTypes('英語')){
  const selected=selectQuestions(all,'中学',{id:`中学:英語:${grade}`,sections:null,practiceType:type.id},catalog);
  assert.ok(selected.length,`${grade}: ${type.id}`);
  const queue=makeQuestionQueue(selected,()=>.5,q=>matchesPracticeQuestion(q,type.id));assert.ok(queue.length);
  assert.ok(queue.every(q=>matchesPracticeQuestion(q,type.id)));
  if(type.id==='reading')assert.ok(queue.every(q=>q.field==='英文読解'&&q.mode==='learning_point'));
 }
});
test('larger spelling units finish every segment and histories remain tied to the original direction and source',()=>{
 const item=core.find(q=>q.english==='responsibility')||core.find(q=>q.english==='agriculture');
 const stages=makeSpellingQuestions(item,()=>.5),game=new Game([item],[],0,()=>.5);
 game.questions=stages;game.questionIndex=0;game.changePhase('answer',0);let now=2,history=normalizeHistory(null);
 for(let i=0;i<stages.length;i++){
  const q=game.question;assert.equal(q.id,stages[i].id);
  for(let n=0;n<3;n++){now++;game.notes.push({target:now,lane:q.correct,color:q.correct,done:false});game.tap(q.correct,now);}
  history=recordAnswer(history,q,{correct:true,chosen:q.answer,attempt:'stage'+i});now+=2.6;game.update(now);
  if(i<stages.length-1){assert.equal(game.phase,'read');now+=game.reveal.duration;game.update(now);}
 }
 assert.equal(game.correctCount,stages.length);assert.equal(questionCoverage(stages,history).solved,stages.length);
 for(const q of stages)assert.equal(history.questions[questionKey(q)].first,1);
 const pick=createAdaptivePicker(stages,()=>history,()=>.5);assert.equal(pick().length,stages.length);
});
test('expanded English filters complete ideal five-minute sessions with 120 counted opportunities',()=>{
 for(const type of practiceTypes('英語'))for(const seed of [1,2,3]){
  const result=simulateSession(english,seed,0,{acceptQuestion:q=>matchesPracticeQuestion(q,type.id)});
  assert.equal(result.counted,120,type.id);assert.equal(result.taps,120,type.id);assert.ok(result.answers>0,type.id);
 }
});
