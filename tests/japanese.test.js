import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game, RULES, makeJapaneseQuestions,makeQuestionQueue,revealPlan} from '../game.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const japanese=read('quiz-data/junior_japanese.json');
const all=[...read('quiz-data/junior_science.json'),...read('quiz-data/junior_english.json'),...japanese];
test('Japanese initial set includes all requested forms with four unique choices',()=>{
 assert.equal(japanese.length,38);const generated=japanese.flatMap(q=>makeJapaneseQuestions(q));assert.equal(generated.length,76);
 assert.equal(new Set(all.map(q=>q.id)).size,159);
 for(const q of generated){assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.equal(q.choices[q.correct],q.answer);assert.ok(q.sourceId);assert.ok(!q.prompt.includes('{{'));}
 for(const field of ['現代文文法','古文文法','漢文文法']){
  const items=japanese.filter(q=>q.field===field);assert.equal(items.length,6);
  for(const item of items)assert.deepEqual(new Set(makeJapaneseQuestions(item).map(q=>q.mode)),new Set(['term_to_explanation','explanation_to_term']));
 }
 for(const item of japanese.filter(q=>q.kind==='idiom'))assert.deepEqual(new Set(makeJapaneseQuestions(item).map(q=>q.mode)),new Set(['japanese_definition','japanese_term']));
});
test('kanji writing uses glyphs and partial diagrams without showing the completed answer',()=>{
 for(const item of japanese.filter(q=>q.kind==='kanji')){
  const [reading,writing]=makeJapaneseQuestions(item);
  assert.equal(reading.answer,item.reading);assert.ok(reading.prompt.includes(item.word));
  assert.equal(writing.mode,'kanji_component');assert.equal(writing.answer,item.component);assert.equal(writing.diagram.fixed,item.fixed_component);
  assert.ok(writing.choices.every(c=>Array.from(c).length===1));
  assert.ok(!writing.prompt.includes(item.character));assert.ok(!writing.task.includes(item.character));assert.ok(writing.note.includes(item.character));
 }
 const shokei=japanese.find(q=>q.word==='憧憬');assert.ok(!shokei.reading_dummies.includes('どうけい'));
});
test('50 shuffled full queues space same-source variants across subjects and at the cycle boundary',()=>{
 for(let seed=1;seed<=50;seed++){
  let state=seed;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
  const queue=makeQuestionQueue(all,random);assert.equal(queue.length,409);
  const units=[];
  for(const [i,q] of queue.entries()){
   if(q.continuation){assert.ok(['spelling','term_to_explanation'].includes(q.mode));assert.equal(queue[i-1].sourceId,q.sourceId);assert.equal(q.blankPosition,queue[i-1].blankPosition+1);continue;}
   units.push(q);
  }
  for(let i=0;i<units.length;i++)for(let gap=1;gap<=3;gap++)assert.notEqual(units[i].sourceId,units[(i+gap)%units.length].sourceId,`seed ${seed}, ${i}, gap ${gap}`);
  assert.equal(new Set(units.slice(0,3).map(q=>q.subject)).size,3);
  const phrase=queue.filter(q=>q.sourceId==='jr_en2_029'&&q.mode==='phrase');assert.equal(phrase.length,3);
  assert.deepEqual(phrase.map(q=>q.prompt),['？ care of','take ？ of','take care ？']);
  for(const q of phrase)assert.equal(revealPlan(q).continuation,false);
 }
});

test('a three-blank grammar explanation stays together, retries errors, and completes before another source',()=>{
 const item={...japanese.find(q=>q.kind==='grammar'),id:'test-three-blanks',explanation_template:'{{1}}、{{2}}、{{3}}。',
  blanks:[1,2,3].map(index=>({index,answer:'正解'+index,dummies:['誤答A','誤答B','誤答C']}))};
 const g=new Game([item,...japanese.filter(q=>q.kind==='kanji').slice(0,3)],[],0,()=>.5);
 g.questionIndex=g.questions.findIndex(q=>q.sourceId===item.id&&q.mode==='term_to_explanation');
 let now=0;
 for(let stage=1;stage<=3;stage++){
  assert.equal(g.question.sourceId,item.id);assert.equal(g.question.blankPosition,stage);g.changePhase('answer',now);
  const hit=color=>{now+=1;g.notes.push({target:now,lane:color,color});g.tap(color,now);};
  if(stage===2){for(let n=0;n<3;n++)hit((g.question.correct+1)%4);assert.equal(g.question.blankPosition,2);assert.equal(g.phase,'answer');}
  for(let n=0;n<3;n++)hit(g.question.correct);
  assert.equal(g.phase,'feedback');now+=RULES.feedbackSeconds;g.update(now);
  if(stage<3){assert.equal(g.question.blankPosition,stage+1);assert.equal(g.reveal.continuation,true);assert.equal(g.reveal.duration,RULES.readHoldSeconds);}
 }
 assert.notEqual(g.question.sourceId,item.id);assert.equal(g.correctCount,3);
});
