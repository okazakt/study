// Unit/content scope only; no five-minute play simulation.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeSpellingQuestions,makeEnglishQuestion,makeChoiceQuestion} from '../game.js';
import {choicePresentations} from '../choice-variants.js';
import {buildCatalog,selectQuestions,sectionKey} from '../learning.js';
import {normalizeHistory,recordAnswer,questionKey,priorityCategory,buildPriorityIndex} from '../progress.js';
const read=n=>JSON.parse(readFileSync(new URL(`../quiz-data/${n}.json`,import.meta.url)));
const all=['junior_english','junior_expansion','junior_english_core','junior_english_extended','junior_english_application','junior_english_supplement','junior_english_vocabulary2'].flatMap(read).filter(q=>q.subject==='英語');
const words=all.filter(q=>q.content_batch==='english-foundations-audit-1'),grammar=all.filter(q=>q.content_batch==='english-application-3');
const audit=JSON.parse(readFileSync(new URL('../docs/content/english-audit.json',import.meta.url)));
test('audited baseline vocabulary has 96 new stable headwords and spelling reconstructs every one uniquely',()=>{
 assert.equal(words.length,96);assert.equal(makeQuestionQueue(words,()=>.5).length,344);
 const lexical=all.filter(q=>q.english);assert.equal(new Set(lexical.map(q=>q.english.toLowerCase())).size,lexical.length);assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 for(const item of words){let prefix='';for(const q of makeSpellingQuestions(item,()=>.5)){for(const c of q.choices){assert.equal(c.length,q.answer.length);assert.equal(item.english.slice(prefix.length).startsWith(c),c===q.answer,item.english+':'+c);}prefix+=q.answer;}assert.equal(prefix,item.english);}
 assert.equal(all.filter(q=>q.field==='英単語').length,2255);assert.equal(all.length,2699);assert.equal(makeQuestionQueue(all,()=>.5).length,9970);
});
test('32 gap points and all 48 reading points have distinct authored contexts with shared identities',()=>{
 assert.equal(grammar.length,32);const reading=all.filter(q=>q.field==='英文読解');assert.equal(reading.length,48);assert.ok(reading.every(q=>q.presentations.length===1));
 for(const item of [...grammar,...reading]){const patterns=choicePresentations(item);assert.equal(patterns.length,2);assert.notEqual(patterns[0].prompt,patterns[1].prompt);const a=makeChoiceQuestion(item,()=>0),b=makeChoiceQuestion(item,()=>.99);assert.equal(questionKey(a),questionKey(b));assert.notEqual(a.variant.signature,b.variant.signature);}
 const varied=all.filter(q=>q.presentations?.length);assert.equal(varied.length,166);assert.equal(varied.flatMap(choicePresentations).length,332);
});
test('every authored English presentation and all new vocabulary choices fit the content budget',()=>{
 for(const item of all.filter(q=>q.kind==='choice'))for(const p of choicePresentations(item)){assert.equal(new Set([p.answer,...p.dummies]).size,4,item.id);assert.ok([p.answer,...p.dummies].every(s=>s.length&&[...s].length<=30),item.id);assert.ok([...p.prompt+item.task+p.answer+p.dummies.join('')].length<=200,item.id);}
 for(const q of makeQuestionQueue(words,()=>.5)){assert.equal(new Set(q.choices).size,4);assert.ok(q.choices.every(s=>[...s].length<=30));assert.ok([...q.prompt+q.task+q.choices.join('')].length<=200,q.id);}
});
test('audited candidates, grammar evidence and reading pattern IDs all resolve while unverified scope stays explicit',()=>{
 assert.equal(audit.curriculum_verified,false);assert.equal(audit.textbook_verified,false);assert.equal(audit.vocabulary_candidates.length,96);assert.equal(audit.grammar_gaps.length,32);assert.equal(audit.reading_patterns.length,48);
 for(const row of audit.vocabulary_candidates)assert.equal(all.find(q=>q.id===row.sourceId).english,row.english);
 for(const row of audit.grammar_gaps)assert.equal(all.find(q=>q.id===row.sourceId).learning_point,row.point);
 for(const row of audit.reading_patterns)assert.deepEqual(choicePresentations(all.find(q=>q.id===row.sourceId)).map(p=>p.id),row.patterns);
});
test('new points remain selectable by grade and unit and share outcomes across spelling or text presentations',()=>{
 const catalog=buildCatalog(all);
 for(const item of [...words,...grammar]){const selected=selectQuestions(all,'中学',{id:`中学:英語:${item.grade.at(-1)}`,sections:[sectionKey(item)],practiceType:'all'},catalog);assert.ok(selected.some(q=>q.id===item.id));assert.ok(selected.every(q=>q.grade===item.grade&&sectionKey(q)===sectionKey(item)));}
 const a=makeChoiceQuestion(grammar[0],()=>0),b=makeChoiceQuestion(grammar[0],()=>.99);let history=normalizeHistory(null);
 history=recordAnswer(history,a,{correct:false,chosen:a.choices.find(s=>s!==a.answer),attempt:'one',time:1});history=recordAnswer(history,a,{correct:true,chosen:a.answer,wrongBefore:1,attempt:'one',time:2});history=recordAnswer(history,b,{correct:true,chosen:b.answer,attempt:'two',time:3});history=normalizeHistory(JSON.parse(JSON.stringify(history)));
 const row=history.questions[questionKey(a)];assert.equal(row.answerCount,2);assert.equal(row.first,1);assert.equal(row.wrong,1);assert.equal(row.patternUsage.base.count,1);assert.equal(row.patternUsage['context-2'].count,1);
 const en=makeEnglishQuestion(words[0],'to_english',()=>.5),ja=makeEnglishQuestion(words[0],'to_japanese',()=>.5);history=recordAnswer(history,en,{correct:true,attempt:'word',time:4});assert.equal(priorityCategory(ja,buildPriorityIndex(history)),3);
});
