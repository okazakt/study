import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mathSequenceParameters,makeMathSequenceQuestions,renderMathSequence} from '../math-sequences.js';
import {makeQuestionQueue,Game,revealPlan,RULES} from '../game.js';
import {FocusGame,focusReveal} from '../focus-game.js';
import {choiceColumns} from '../learning.js';
import {createAdaptivePicker,normalizeHistory,recordAnswer,questionKey,questionCoverage,missedQuestions} from '../progress.js';
const items=JSON.parse(readFileSync(new URL('../quiz-data/junior_math.json',import.meta.url))).filter(q=>q.kind==='math_sequence');
const events=Array.from({length:241},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0,type:'beat'}));
const item=items.find(q=>q.sequence_generator==='substitution');

test('every finite parameter choice keeps all steps together with one identity and parameter snapshot',()=>{
 for(const source of items){
  const parameters=mathSequenceParameters(source.sequence_generator);
  for(let v=0;v<parameters.length;v++){
   const qs=makeMathSequenceQuestions(source,()=>(v+.1)/parameters.length);
   assert.ok(qs.length>=2&&qs.length<=4);
   assert.deepEqual(qs[0].variant.parameters,parameters[v]);
   for(const [i,q] of qs.entries()){
    assert.equal(q.sourceId,source.id);assert.equal(q.mode,'math_sequence');assert.equal(q.blankIndex,i+1);
    assert.equal(q.continuation,i>0);assert.equal(q.refreshPrompt,true);
    assert.deepEqual(q.variant,qs[0].variant);assert.equal(q.choices[q.correct],q.answer);
    assert.equal(new Set(q.choices).size,4);assert.ok(q.note&&q.skill);
   }
  }
 }
});

test('adaptive selection changes the whole chain once and preserves history keys across values',()=>{
 let history=normalizeHistory(null);
 const picker=createAdaptivePicker(makeQuestionQueue([item],()=>0),()=>history,()=>0);
 const first=picker(),second=picker();
 assert.notEqual(first[0].variant.signature,second[0].variant.signature);
 assert.equal(questionKey(first[0]),questionKey(second[0]));
 assert.equal(questionCoverage([...first,...second],history).total,first.length);
 for(const q of second)history=recordAnswer(history,q,{correct:true,chosen:q.answer,attempt:q.id});
 const loaded=normalizeHistory(JSON.parse(JSON.stringify(history)));
 const fresh=createAdaptivePicker(makeQuestionQueue([item],()=>0),()=>loaded,()=>0)();
 assert.notEqual(fresh[0].variant.signature,second[0].variant.signature);
 for(const q of fresh)assert.equal(q.variant.signature,fresh[0].variant.signature);
});

test('normal play retries the same values and progresses every stage before another problem',()=>{
 const g=new Game([item],[],0,()=>0);let now=1;
 const original=JSON.stringify(g.question);g.changePhase('answer',now);
 for(let i=0;i<3;i++){
  now+=.5;const lane=(g.question.correct+1)%4;
  g.notes.push({target:now,lane,color:lane,done:false});g.tap(lane,now);
 }
 assert.equal(g.wrongCount,1);assert.equal(g.questionIndex,0);assert.equal(JSON.stringify(g.question),original);
 const signature=g.question.variant.signature,stages=g.questions.length;
 for(let i=0;i<stages;i++){
  assert.equal(g.question.blankIndex,i+1);assert.equal(g.question.variant.signature,signature);
  g.changePhase('answer',now);
  for(let j=0;j<3;j++){now+=.5;const lane=g.question.correct;g.notes.push({target:now,lane,color:lane,done:false});g.tap(lane,now);}
  assert.equal(g.phase,'feedback');assert.equal(g.correctCount,i+1);
  if(i<stages-1){now+=RULES.feedbackSeconds+1;g.update(now);assert.equal(g.phase,'read');assert.equal(g.questionIndex,i+1);}
 }
});

test('focus play finishes every stage and out-of-time taps neither answer nor mark a miss',()=>{
 const g=new FocusGame([item],events,0,()=>0,Infinity,()=>true,null,Infinity,null,{speed:'instant'});
 g.update(0);const original=JSON.stringify(g.question);
 assert.equal(g.tap(g.question.correct,.25),null);assert.equal(JSON.stringify(g.question),original);assert.equal(g.wrongCount,0);
 const stages=g.questions.length,signature=g.question.variant.signature;
 for(let i=0;i<stages;i++){
  const now=g.beats.find(b=>!b.done&&b.target>g.time+.1).target;g.update(now);
  assert.equal(g.phase,'answer');assert.equal(g.question.blankIndex,i+1);
  assert.equal(g.question.variant.signature,signature);g.tap(g.question.correct,now);
  assert.equal(g.phase,'feedback');
  if(i<stages-1)g.update(g.nextQuestionAt);
 }
 assert.equal(g.correctCount,stages);assert.equal(g.combo,0);
});

test('reading reserves the new prompt on later math stages but keeps old blank behavior',()=>{
 const qs=makeMathSequenceQuestions(item,()=>0),q=qs[1];
 for(const speed of ['slow','normal']){
  const plan=revealPlan(q,speed),focus=focusReveal(q,speed);
  assert.ok(plan.prompt.end>plan.prompt.start);assert.ok(plan.choices[0].start>=plan.prompt.end);
  assert.ok(focus.prompt.end>0);assert.ok(focus.choices[0].start>=focus.prompt.end);
  const existing=revealPlan({...q,refreshPrompt:false},speed);assert.equal(existing.prompt.end,0);
 }
 assert.equal(focusReveal(q,'instant').duration,0);
});

test('admission reserves the full chain, rejecting an ending that fits just its first stage',()=>{
 const g=new Game([item],events,0,()=>0,Infinity,()=>true,null,Infinity,null,{speed:'instant'});
 const start=8,full=g.earliestCompletion(start);
 const firstReady=start+revealPlan(g.question,'instant').duration+RULES.travelSeconds;
 const firstDone=g.events.filter(e=>g.answerEvent(e)&&e.target>=firstReady)[2].target+RULES.feedbackSeconds;
 assert.ok(full>firstDone);g.endTime=firstDone+.3;g.changePhase('read',start);assert.equal(g.phase,'outro');
 const f=new FocusGame([item],events,0,()=>0,Infinity,()=>true,null,Infinity,null,{speed:'instant'});
 const focusEnd=f.earliestCompletion(start);assert.ok(focusEnd>f.beatAfter(start,3));
 f.endTime=f.beatAfter(start,3);f.changePhase('read',start);assert.equal(f.phase,'outro');
});

test('each stage stores independent errors, choices, datetime and exact numbers for review',()=>{
 const chain=makeMathSequenceQuestions(item,()=>.5);let history=normalizeHistory(null);
 history=recordAnswer(history,chain[1],{correct:false,chosen:chain[1].dummies[0],time:10,attempt:'a'});
 history=recordAnswer(history,chain[1],{correct:true,chosen:chain[1].answer,time:11,wrongBefore:1,attempt:'a'});
 history=recordAnswer(history,chain[2],{correct:true,chosen:chain[2].answer,time:12,attempt:'b'});
 history=normalizeHistory(JSON.parse(JSON.stringify(history)));
 const row=history.questions[questionKey(chain[1])];assert.equal(row.wrong,1);assert.equal(row.first,0);assert.equal(row.lastAt,11);
 assert.deepEqual(row.presentation,{prompt:chain[1].prompt,choices:chain[1].choices,note:chain[1].note});
 assert.deepEqual(row.variant,chain[1].variant);assert.equal(history.questions[questionKey(chain[2])].first,1);
 assert.deepEqual(missedQuestions([{question:chain[1],wrong:1,correct:true}]),[chain[1]]);
});

test('sequence units stay contiguous, do not create reverse quizzes, and load their offline module',()=>{
 const queue=makeQuestionQueue(items,()=>.4);
 for(const source of items){const indices=queue.flatMap((q,i)=>q.sourceId===source.id?[i]:[]);assert.equal(indices.length,source.steps.length);assert.equal(indices.at(-1)-indices[0]+1,indices.length);}
 assert.ok(queue.every(q=>q.mode==='math_sequence'));
 assert.match(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/'\.\/math-sequences\.js'/);
 assert.throws(()=>renderMathSequence(item,{a:0}));
 assert.throws(()=>mathSequenceParameters('missing'));
});

test('long sequence formulas use two columns without changing other four-color choices',()=>{
 const q=makeMathSequenceQuestions(items.find(q=>q.sequence_generator==='rationalize'),()=>0)[0];
 assert.equal(choiceColumns(q),2);
 assert.equal(choiceColumns({...q,mode:'learning_point'}),4);
 assert.equal(choiceColumns({...q,choices:['1','2','3','4']}),4);
});
