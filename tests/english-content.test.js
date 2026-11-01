// Data and per-question checks only. No session or five-minute simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeEnglishQuestion,makeSpellingQuestions,makePhraseQuestions} from '../game.js';
import {buildCatalog,selectQuestions,matchesPracticeQuestion,practiceTypes,sectionKey} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,questionCoverage,createAdaptivePicker} from '../progress.js';
const read=name=>JSON.parse(readFileSync(new URL(`../quiz-data/${name}.json`,import.meta.url)));
const extended=read('junior_english_extended');
const all=['junior_japanese','junior_english','junior_math','junior_science','junior_social','junior_expansion','junior_english_supplement','junior_english_vocabulary2','junior_english_core','junior_english_application'].flatMap(read).concat(extended);
const english=all.filter(item=>item.subject==='英語'),catalog=buildCatalog(all);
test('extended English vocabulary and phrases have stable distinct identities without replacing previous items',()=>{
 assert.equal(extended.length,645);assert.equal(extended.filter(q=>q.field==='英単語').length,581);assert.equal(extended.filter(q=>q.field==='熟語').length,64);
 assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 const words=english.filter(q=>q.english);assert.equal(new Set(words.map(q=>q.english.toLowerCase())).size,words.length);
 assert.equal(english.length,2922);assert.equal(makeQuestionQueue(english,()=>.5).length,10757);
 assert.ok(extended.every(q=>q.school_level==='中学'&&q.subject==='英語'&&['中2','中3'].includes(q.grade)));
});
test('each new generated question has four unique choices and stays inside its display budget',()=>{
 const questions=makeQuestionQueue(extended,()=>.5);assert.equal(questions.length,2573);
 for(const q of questions){
  assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices).size,4,q.id);assert.equal(q.choices[q.correct],q.answer,q.id);
  assert.ok(q.prompt&&!q.prompt.includes('{{'),q.id);assert.equal(typeof q.note,'string');
  assert.ok(q.choices.every(text=>typeof text==='string'&&text.length&&Array.from(text).length<=30),q.id);
  assert.ok(Array.from(q.prompt+q.task+q.choices.join('')).length<=200,q.id);
 }
});
test('all English spelling choices reconstruct the word without offering an ambiguous alternative split',()=>{
 for(const item of english.filter(q=>q.spelling)){
  assert.equal(item.spelling_template.replace(/\{\{(\d+)\}\}/g,(_,i)=>item.spelling[i-1].answer),item.english);
  let prefix='';
  for(const q of makeSpellingQuestions(item,()=>.5)){
   for(const choice of q.choices){assert.equal(choice.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(choice),choice===q.answer,item.english+': '+choice);}
   assert.equal(q.continuation,q.blankPosition>1);prefix+=q.answer;
  }
 }
});
test('phrase word holes use their own position and retain the same meaning in both translation directions',()=>{
 for(const item of english.filter(q=>q.phrase_blanks)){
  for(const q of makePhraseQuestions(item,()=>.5)){
   assert.equal(q.answer,item.english.split(' ')[q.blankIndex-1],q.id);assert.equal(q.choices[q.correct],q.answer);
   assert.ok(q.prompt.includes('？'));assert.ok(!q.continuation);
  }
  for(const direction of ['to_english','to_japanese']){
   const q=makeEnglishQuestion(item,direction,()=>.5);assert.equal(q.sourceId,item.id);assert.equal(q.answer,direction==='to_english'?item.english:item.japanese);
  }
 }
});
test('edited overlapping meanings and alternate valid phrasings are not offered as wrong answers',()=>{
 const pairs=[['correct','exact'],['describe','express'],['prove','confirm'],['confirm','admit'],['consider','judge'],['trust','believe'],['cooperate','contribute'],['appear','seem'],['war','conflict'],['business','company'],['company','organization'],['organization','institution'],['equipment','tool'],['invention','innovation'],['gas','vapor'],['cause','factor'],['progress','improvement'],['decision','choice'],['solution','strategy'],['attitude','behavior'],['behavior','habit'],['relationship','partnership'],['ask for','send for'],['in trouble','in danger']];
 for(const [a,b] of pairs)for(const [target,other] of [[a,b],[b,a]]){
  const item=extended.find(q=>q.english===target);if(item)assert.ok(!item.english_dummies.includes(other),target+': '+other);
 }
 for(const [phrase,excluded] of [['talk to','with'],['talk about','of'],['write down','out'],['fill in','out'],['depend on','upon'],['give up','in'],['on time','in'],['in time','on']]){
  const item=extended.find(q=>q.english===phrase);assert.ok(item);assert.ok(!item.phrase_blanks[0].dummies.includes(excluded),phrase);
 }
});
test('the complete English bank filters by grade type and unit without silently broadening selection',()=>{
 for(const year of [1,2,3])for(const type of practiceTypes('英語')){
  const selection={id:`中学:英語:${year}`,sections:null,practiceType:type.id};
  const selected=selectQuestions(all,'中学',selection,catalog);assert.ok(selected.length,year+': '+type.id);
  const queue=makeQuestionQueue(selected,()=>.5,q=>matchesPracticeQuestion(q,type.id));assert.ok(queue.length);
  assert.ok(queue.every(q=>q.grade===`中${year}`&&matchesPracticeQuestion(q,type.id)));
 }
 for(const item of extended){
  const selected=selectQuestions(all,'中学',{id:`中学:英語:${item.grade.slice(-1)}`,sections:[sectionKey(item)],practiceType:'all'},catalog);
  assert.ok(selected.some(q=>q.id===item.id));assert.ok(selected.every(q=>sectionKey(q)===sectionKey(item)));
 }
});
test('new items preserve per-direction history and coverage through a wrong answer and correction',()=>{
 for(const item of [extended.find(q=>q.spelling),extended.find(q=>q.phrase_blanks)]){
  const q=makeEnglishQuestion(item,'to_english',()=>.5);let history=normalizeHistory(null);
  history=recordAnswer(history,q,{correct:false,chosen:q.choices[(q.correct+1)%4],attempt:'same',time:1});
  history=recordAnswer(history,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'same',time:2});
  const restored=normalizeHistory(JSON.parse(JSON.stringify(history))),row=restored.questions[questionKey(q)];
  assert.equal(row.answerCount,1);assert.equal(row.correct,1);assert.equal(row.wrong,1);assert.equal(row.first,0);
  assert.equal(questionCoverage([q],restored).solved,1);
  const picked=createAdaptivePicker([q],()=>restored,()=>.5)()[0];assert.equal(questionKey(picked),questionKey(q));
 }
});
