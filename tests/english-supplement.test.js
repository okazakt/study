// Per-question content checks only; intentionally no five-minute simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeEnglishQuestion,makeSpellingQuestions,makePhraseQuestions} from '../game.js';
import {buildCatalog,selectQuestions,sectionKey,matchesPracticeQuestion} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,priorityCategory,buildPriorityIndex} from '../progress.js';
const read=n=>JSON.parse(readFileSync(new URL(`../quiz-data/${n}.json`,import.meta.url)));
const added=read('junior_english_supplement'),all=['junior_english','junior_expansion','junior_english_core','junior_english_extended','junior_english_application','junior_english_vocabulary2'].flatMap(read).filter(q=>q.subject==='英語').concat(added);
test('supplement adds 511 words and 58 phrases, preserving earlier identities and unique headwords',()=>{
 assert.equal(added.length,569);assert.equal(added.filter(q=>q.field==='英単語').length,511);assert.equal(added.filter(q=>q.field==='熟語').length,58);
 assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 const lexical=all.filter(q=>q.english);assert.equal(new Set(lexical.map(q=>q.english.toLowerCase())).size,lexical.length);
 assert.equal(all.length,2910);assert.equal(makeQuestionQueue(all,()=>.5).length,10745);
});
test('all 2214 new questions have four distinct choices and fit the content budget',()=>{
 const qs=makeQuestionQueue(added,()=>.5);assert.equal(qs.length,2214);
 for(const q of qs){assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices).size,4,q.id);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.choices.every(s=>[...s].length<=30),q.id);assert.ok([...q.prompt+q.task+q.choices.join('')].length<=200,q.id);}
});
test('spelling has equal-length alternatives, a unique next prefix and reconstructs the entire headword',()=>{
 for(const item of added.filter(q=>q.spelling)){
  let prefix='';for(const q of makeSpellingQuestions(item,()=>.5)){
   assert.equal(q.continuation,q.blankPosition>1);for(const s of q.choices){assert.equal(s.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(s),s===q.answer,item.english+':'+s);}prefix+=q.answer;
  }assert.equal(prefix,item.english,item.id);
 }
});
test('phrase holes target actual words and do not make multiple phrase positions a continuous spelling unit',()=>{
 for(const item of added.filter(q=>q.phrase_blanks))for(const q of makePhraseQuestions(item,()=>.5)){
  assert.equal(q.answer,item.english.split(' ')[q.blankIndex-1]);assert.equal(q.choices[q.correct],q.answer);assert.ok(!q.continuation);assert.ok(q.prompt.includes('？'));
 }
 for(const [en,other] of [['have fun','enjoy oneself'],['lots of','a lot of'],['quiz','exam'],['bag','backpack'],['silent','speechless'],['blame','criticize'],['regular','usual']]){
  const item=added.find(q=>q.english===en);assert.ok(!item.english_dummies.includes(other),en);
 }
});
test('new bank is reachable through the correct grade, unit and English direction selections',()=>{
 const catalog=buildCatalog(all);
 for(const item of added){const selection={id:`中学:英語:${item.grade.at(-1)}`,sections:[sectionKey(item)],practiceType:'all'};const chosen=selectQuestions(all,'中学',selection,catalog);assert.ok(chosen.some(q=>q.id===item.id));assert.ok(chosen.every(q=>q.grade===item.grade&&sectionKey(q)===sectionKey(item)));}
 for(const type of ['word_ja_en','word_en_ja','word_spelling','phrase_ja_en','phrase_en_ja'])assert.ok(makeQuestionQueue(added,()=>.5,q=>matchesPracticeQuestion(q,type)).length);
});
test('new directions retain separate answer histories across reload and recent first-try results affect priority',()=>{
 const item=added[0],q=makeEnglishQuestion(item,'to_english',()=>.5),reverse=makeEnglishQuestion(item,'to_japanese',()=>.5);let state=normalizeHistory(null);
 state=recordAnswer(state,q,{correct:false,chosen:q.choices.find(s=>s!==q.answer),attempt:'one',time:1});state=recordAnswer(state,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'one',time:2});
 state=normalizeHistory(JSON.parse(JSON.stringify(state)));assert.equal(state.questions[questionKey(q)].answerCount,1);assert.equal(priorityCategory(reverse,buildPriorityIndex(state)),2);
 for(let i=0;i<3;i++)state=recordAnswer(state,q,{correct:true,attempt:'later'+i,time:3+i});assert.equal(priorityCategory(q,buildPriorityIndex(state)),6);assert.equal(state.questions[questionKey(q)].first,3);
});
