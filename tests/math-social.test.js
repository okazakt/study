import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,makeQuestion,makeBlankQuestions,makeQuestionQueue} from '../game.js';
const read=name=>JSON.parse(readFileSync(new URL(`../quiz-data/${name}.json`,import.meta.url)));
const math=read('junior_math'),social=read('junior_social');
test('new samples resolve every blank and provide distinct four-choice answers in both directions',()=>{
 const all=[...math,...social];assert.equal(new Set(all.map(q=>q.id)).size,24);
 for(const item of all){
  assert.equal(item.school_level,'中学');assert.equal(item.grade,item.subject==='数学'?'中2':'中3');
  assert.deepEqual([...item.explanation_template.matchAll(/\{\{(\d+)\}\}/g)].map(m=>+m[1]),item.blanks.map(b=>b.index));
  const term=makeQuestion(item);assert.ok(!term.prompt.includes('{{'));assert.ok(!term.prompt.includes('？'));
  for(const q of [term,...makeBlankQuestions(item)]){
   assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.equal(q.choices[q.correct],q.answer);
   if(q.mode==='term_to_explanation')assert.equal(q.segments.filter(s=>s.state==='active').length,1);
  }
 }
 assert.equal(makeQuestionQueue(math).length,13);assert.equal(makeQuestionQueue(social).length,26);
});
test('sample content includes all three congruence criteria and correctly scoped civic institutions and duties',()=>{
 const congruence=math.filter(q=>q.unit==='三角形の合同');assert.equal(congruence.length,3);
 assert.ok(makeQuestion(congruence[0]).prompt.includes('3組の辺'));
 assert.ok(makeQuestion(congruence[1]).prompt.includes('2組の辺とその間の角'));
 assert.ok(makeQuestion(congruence[2]).prompt.includes('1組の辺とその両端の角'));
 const expected={国会:'立法',内閣:'行政',裁判所:'司法',国民主権:'国民',平和主義:'9'};
 for(const [term,answer] of Object.entries(expected))assert.equal(social.find(q=>q.term===term).blanks[0].answer,answer);
 assert.deepEqual(social.find(q=>q.term==='国民の三大義務').blanks.map(b=>b.answer),['普通教育を受けさせる','勤労','納税']);
});
test('multi-part formulas and duties retain every continuation through actual game answers',()=>{
 for(const item of [...math,...social].filter(q=>q.blanks.length>1)){
  const g=new Game([item],[],0,()=>.5);g.questionIndex=g.questions.findIndex(q=>q.blankPosition===1);g.changePhase('answer',0);
  let now=2;
  for(let stage=1;stage<=item.blanks.length;stage++){
   assert.equal(g.question.blankPosition,stage);
   if(stage>1){assert.equal(g.phase,'read');assert.equal(g.reveal.continuation,true);now+=g.reveal.duration;g.update(now);}
   for(let n=0;n<3;n++){now++;g.notes.push({target:now,lane:g.question.correct,color:g.question.correct,done:false});g.tap(g.question.correct,now);}
   assert.equal(g.phase,'feedback');now+=2.6;g.update(now);
  }
  assert.equal(g.correctCount,item.blanks.length);
 }
});

test('math only presents explanation blanks, including new grades, while other subjects retain reverse questions',()=>{
 const future={...math[0],id:'future_math',grade:'中3',term_dummies:[]};
 for(const items of [math,[future],[...math,...social]]){
  const queue=makeQuestionQueue(items,()=>.5),mathQuestions=queue.filter(q=>q.subject==='数学');
  assert.ok(mathQuestions.length);assert.ok(mathQuestions.every(q=>q.mode==='term_to_explanation'));
  assert.equal(mathQuestions.length,items.filter(q=>q.subject==='数学').reduce((n,item)=>n+item.blanks.length,0));
 }
 assert.ok(makeQuestionQueue(social).some(q=>q.mode==='explanation_to_term'));
 const multi=math.find(q=>q.blanks.length>1),parts=makeQuestionQueue([multi]);
 assert.deepEqual(parts.map(q=>q.blankIndex),multi.blanks.map(b=>b.index));assert.equal(parts[1].continuation,true);
});
