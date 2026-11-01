// Content-only validation; no timed session or five-minute simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeSpellingQuestions,makeEnglishQuestion,makePhraseQuestions} from '../game.js';
import {buildCatalog,selectQuestions,sectionKey,matchesPracticeQuestion} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,priorityCategory,buildPriorityIndex} from '../progress.js';
const read=n=>JSON.parse(readFileSync(new URL(`../quiz-data/${n}.json`,import.meta.url)));
const bank=read('junior_english_vocabulary2'),added=bank.filter(q=>q.content_batch==='english-vocabulary-2'),prior=['junior_english','junior_expansion','junior_english_core','junior_english_extended','junior_english_application','junior_english_supplement'].flatMap(read).filter(q=>q.subject==='英語'),all=prior.concat(bank);
test('520 new headwords have unique stable IDs and do not replace existing learning history',()=>{
 assert.equal(added.length,520);assert.ok(added.every(q=>q.field==='英単語'&&q.school_level==='中学'&&q.subject==='英語'&&['中1','中2','中3'].includes(q.grade)));
 assert.equal(new Set(all.map(q=>q.id)).size,all.length);const words=all.filter(q=>q.english);assert.equal(new Set(words.map(q=>q.english.toLowerCase())).size,words.length);
 assert.equal(all.filter(q=>q.field==='英単語').length,2382);assert.equal(all.length,2922);assert.equal(makeQuestionQueue(all,()=>.5).length,10757);
});
test('all 2217 generated questions have a unique correct option and respect display limits',()=>{
 const qs=makeQuestionQueue(added,()=>.5);assert.equal(qs.length,2217);
 for(const q of qs){assert.equal(q.choices.length,4,q.id);assert.equal(new Set(q.choices).size,4,q.id);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.choices.every(s=>typeof s==='string'&&s.length&&[...s].length<=30),q.id);assert.ok([...q.prompt+q.task+q.choices.join('')].length<=200,q.id);}
});
test('each spelling step has equal-length options and exactly one possible next prefix',()=>{
 for(const item of added){let prefix='';for(const q of makeSpellingQuestions(item,()=>.5)){
  assert.equal(q.continuation,q.blankPosition>1);for(const s of q.choices){assert.equal(s.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(s),s===q.answer,item.english+': '+s);}prefix+=q.answer;
 }assert.equal(prefix,item.english);}
});
test('edited overlapping meanings do not appear as competing translations',()=>{
 for(const [en,excluded] of [['draw','paint'],['hide','cover'],['nut','almond'],['mutton','lamb'],['certain','doubtless'],['true','real'],['false','fake'],['real','true'],['timer','stopwatch'],['jungle','rainforest'],['swamp','wetland']]){
  const q=added.find(q=>q.english===en);if(q)assert.ok(!q.english_dummies.includes(excluded),en);
 }
});
test('every new item is reachable in its grade and unit with both directions and spelling preserved',()=>{
 const catalog=buildCatalog(all);
 for(const item of added){const selected=selectQuestions(all,'中学',{id:`中学:英語:${item.grade.at(-1)}`,sections:[sectionKey(item)],practiceType:'all'},catalog);assert.ok(selected.some(q=>q.id===item.id));assert.ok(selected.every(q=>q.grade===item.grade&&sectionKey(q)===sectionKey(item)));}
 for(const type of ['word_ja_en','word_en_ja','word_spelling'])assert.ok(makeQuestionQueue(added,()=>.5,q=>matchesPracticeQuestion(q,type)).length);
});
test('per-direction outcomes survive reload, preserve retries as one occurrence and affect reverse priority',()=>{
 const item=added[0],q=makeEnglishQuestion(item,'to_english',()=>.5),reverse=makeEnglishQuestion(item,'to_japanese',()=>.5);let history=normalizeHistory(null);
 history=recordAnswer(history,q,{correct:false,chosen:q.choices.find(s=>s!==q.answer),attempt:'one',time:1});history=recordAnswer(history,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'one',time:2});history=normalizeHistory(JSON.parse(JSON.stringify(history)));
 assert.equal(history.questions[questionKey(q)].answerCount,1);assert.equal(history.questions[questionKey(q)].first,0);assert.equal(priorityCategory(reverse,buildPriorityIndex(history)),2);
});

test('127 textbook-gap basics produce 523 unambiguous directional and spelling questions with stable identities',()=>{
 const basics=bank.filter(q=>q.content_batch==='english-textbook-basics-1');assert.equal(basics.length,127);
 const generated=makeQuestionQueue(basics,()=>.5);assert.equal(generated.length,523);
 for(const q of generated){assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.choices.every(s=>[...s].length<=30),q.id);assert.ok([...q.task+q.prompt+q.choices.join('')].length<=200,q.id);}
 for(const item of basics){let prefix='';for(const q of makeSpellingQuestions(item,()=>.5)){for(const c of q.choices){assert.equal(c.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(c),c===q.answer,item.english);}prefix+=q.answer;}assert.equal(prefix,item.english);}
 for(const en of ['joy','delight','woman','lady']){const q=basics.find(q=>q.english===en);assert.ok(!q.english_dummies.includes({joy:'delight',delight:'joy',woman:'lady',lady:'woman'}[en]));}
});
test('textbook-gap basics remain selectable in all three directions and keep separate per-direction history',()=>{
 const basics=bank.filter(q=>q.content_batch==='english-textbook-basics-1'),catalog=buildCatalog(all);
 for(const item of basics){const chosen=selectQuestions(all,'中学',{id:`中学:英語:${item.grade.at(-1)}`,sections:[sectionKey(item)],practiceType:'all'},catalog);assert.ok(chosen.some(q=>q.id===item.id));}
 for(const type of ['word_ja_en','word_en_ja','word_spelling'])assert.ok(makeQuestionQueue(basics,()=>.5,q=>matchesPracticeQuestion(q,type)).length);
 const q=makeEnglishQuestion(basics[0],'to_english',()=>.5),reverse=makeEnglishQuestion(basics[0],'to_japanese',()=>.5);
 const h=normalizeHistory(JSON.parse(JSON.stringify(recordAnswer(normalizeHistory(null),q,{correct:true,chosen:q.answer,attempt:'basics',time:1234}))));assert.equal(h.questions[questionKey(q)].answerCount,1);assert.equal(h.questions[questionKey(reverse)],undefined);
});

test('84 frequent phrase additions offer 252 distinct four-choice questions within the text budget',()=>{
 const phrases=bank.filter(q=>q.content_batch==='english-phrases-2');assert.equal(phrases.length,84);assert.equal(all.filter(q=>q.field==='熟語').length,270);
 const generated=makeQuestionQueue(phrases,()=>.5);assert.equal(generated.length,252);
 for(const q of generated){assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4,q.id);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.choices.every(s=>[...s].length<=30));assert.ok([...q.prompt+q.task+q.choices.join('')].length<=200,q.id);}
 for(const item of phrases){assert.equal(item.spelling,undefined);const holes=makePhraseQuestions(item,()=>.5);assert.equal(holes.length,1);const q=holes[0];assert.equal(item.english.split(' ')[q.blankIndex-1],q.answer);assert.equal(q.segments.filter(s=>s.state==='active').length,1);assert.ok(!q.choices.includes(q.prompt));}
});
test('equivalent phrase translations do not compete and new idioms retain directional and blank histories',()=>{
 const phrases=bank.filter(q=>q.content_batch==='english-phrases-2');
 for(const [a,b] of [['not at all','you are welcome'],['of course','all right'],['look out','watch out'],['turn into','change into'],['a cup of','a glass of'],['think of','think about']])for(const [source,target] of [[a,b],[b,a]])assert.ok(!phrases.find(q=>q.english===source).english_dummies.includes(target));
 const item=phrases.find(q=>q.english==='put off'),q=makeEnglishQuestion(item,'to_english',()=>.5),reverse=makeEnglishQuestion(item,'to_japanese',()=>.5),blank=makePhraseQuestions(item,()=>.5)[0];
 let h=recordAnswer(normalizeHistory(null),q,{correct:false,chosen:q.choices.find(c=>c!==q.answer),attempt:'phrase',time:1});h=recordAnswer(h,q,{correct:true,chosen:q.answer,wrongBefore:1,attempt:'phrase',time:2});h=normalizeHistory(JSON.parse(JSON.stringify(h)));
 assert.equal(h.questions[questionKey(q)].answerCount,1);assert.equal(h.questions[questionKey(q)].first,0);assert.notEqual(questionKey(q),questionKey(blank));assert.equal(priorityCategory(reverse,buildPriorityIndex(h)),2);
 const catalog=buildCatalog(all);for(const item of phrases){const chosen=selectQuestions(all,'中学',{id:`中学:英語:${item.grade.at(-1)}`,sections:[sectionKey(item)],practiceType:'all'},catalog);assert.ok(chosen.some(q=>q.id===item.id));}
 for(const type of ['phrase_ja_en','phrase_en_ja'])assert.ok(makeQuestionQueue(phrases,()=>.5,q=>matchesPracticeQuestion(q,type)).length);
});
