import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,SCORE,seededRandom,perfectReference,makeQuestionQueue,makePlaylist,sessionPlan} from '../game.js';
import {createAdaptivePicker,normalizeHistory,recordAnswer} from '../progress.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const items=read('quiz-data/junior_math.json');
const create=(questions=1)=>{const g=new Game([items[0]],[],0,()=>.5,300);g.scorePlan={questions,white:120-questions*3,color:questions*3};g.refreshScore();return g;};
function answer(g,wrongAttempts=0){
 g.changePhase('read',0);g.changePhase('answer',0);let time=2;
 for(let attempt=0;attempt<=wrongAttempts;attempt++)for(let i=0;i<3;i++){
  const lane=attempt<wrongAttempts?(g.question.correct+1)%4:g.question.correct;
  g.notes=[{target:time,lane,color:lane}];g.tap(lane,time++);
 }
 return time;
}
test('fixed white and question budgets give the same 10000 points at different question counts',()=>{
 for(const questions of [5,8,15]){
  const g=create(questions);g.whiteJudgments=g.scorePlan.white;g.whiteUnits=g.scorePlan.white;
  g.colorEligibleJudgments=g.scorePlan.color;g.colorUnits=g.scorePlan.color;g.answerUnits=questions;
  g.judgments.PERFECT=g.whiteJudgments+g.colorUnits;g.refreshScore();assert.equal(g.totalScore,10000);assert.deepEqual(g.scoreBreakdown,{white:5000,color:1000,answer:4000,penalty:0,rhythm:6000,total:10000});
 }
});
test('answer points use 100, 80, 50, and zero percent after confirmed wrong answers',()=>{
 for(const [errors,points] of [[0,4000],[1,3200],[2,2000],[3,0],[4,0]]){
  const g=create();answer(g,errors);assert.equal(g.quizScore,points);assert.equal(g.wrongCount,errors);assert.equal(g.correctCount,1);
 }
});
test('only the first three colored rows earn points, while further successful hits still build combo',()=>{
 const g=create();g.changePhase('read',0);g.changePhase('answer',0);const lane=(g.question.correct+1)%4;
 for(let i=0;i<3;i++){g.notes=[{target:2+i,lane,color:lane}];g.tap(lane,2+i);}
 const score=g.totalScore;assert.equal(g.colorUnits,3);assert.equal(g.combo,0);
 for(let i=0;i<2;i++){g.notes=[{target:5+i,lane:g.question.correct,color:g.question.correct}];g.tap(g.question.correct,5+i);}
 assert.equal(g.totalScore,score);assert.equal(g.colorUnits,3);assert.equal(g.combo,2);
 g.tap(3,7);assert.equal(g.combo,0);assert.equal(g.emptyMisses,1);
});
test('misses consume the initial colored scoring slots and do not earn points',()=>{
 const g=create();g.changePhase('read',0);g.changePhase('answer',0);
 for(let i=0;i<3;i++){g.notes=[0,1,2,3].map(lane=>({target:2+i,lane,color:lane,rowId:i}));g.update(2+i+.17);}
 assert.equal(g.missedNotes,3);assert.equal(g.colorRowsUsed,3);
 for(let i=0;i<3;i++){const lane=g.question.correct;g.notes=[{target:6+i,lane,color:lane}];g.tap(lane,6+i);}
 assert.equal(g.colorUnits,0);assert.equal(g.scoreBreakdown.color,0);assert.equal(g.quizScore,4000);assert.equal(g.countedTaps,6);
});
test('GOOD earns half the timing points and empty misses lower rhythm without spending note quota',()=>{
 const g=create();g.changePhase('outro',0);
 g.notes=[{target:2,lane:0,color:null}];g.tap(0,2.12);assert.equal(g.whiteUnits,.5);
 const before=g.totalScore;g.tap(2,3);assert.equal(g.countedTaps,1);assert.equal(g.emptyMisses,1);assert.ok(g.totalScore<before);
 assert.equal(g.scoreBreakdown.answer,0);
});
test('more questions or white opportunities than reference cannot exceed the fixed budgets',()=>{
 const g=create(5);g.whiteJudgments=110;g.whiteUnits=110;g.colorCapacityStarted=30;g.colorUnits=30;g.answerUnits=10;
 for(let i=0;i<10;i++)g.startedQuestions.add(i);
 g.judgments.PERFECT=g.whiteJudgments+g.colorUnits;g.refreshScore();assert.equal(g.totalScore,10000);
 g.answerUnits=9;g.refreshScore();assert.equal(g.quizScore,3600);
});
test('the ideal seeded preview is repeatable and the same perfect run earns the full score',()=>{
 const idx=read('music-data/index.json');const playlist=makePlaylist(['0001','0002'].map(id=>({id,track:idx[id],chart:read('music-data/'+idx[id].files.chart)})));const plan=sessionPlan(playlist.duration);
 const factory=()=>{
  const random=seededRandom(51);let h=normalizeHistory(null);const results=new Map();
  const picker=createAdaptivePicker(makeQuestionQueue(items,random),()=>h,random,()=>results.values());
  const g=new Game(items,playlist.events,0,random,plan.endTime,()=>true,picker,plan.fadeStart,120);
  const done=(q,index,time)=>{h=recordAnswer(h,q,{correct:true,time:time*1000,attempt:'q'+index});results.set(index,{question:q,correct:true,wrong:0});};return{g,done};
 };
 const a=factory(),reference=perfectReference(a.g,a.done),b=factory();assert.ok(reference.questions>0);assert.equal(reference.white+reference.color,120);
 b.g.scorePlan=reference;assert.deepEqual(perfectReference(b.g,b.done),reference);assert.equal(b.g.totalScore,10000);
});

test('percentage deductions remain identical across question counts without floating point losses',()=>{
 for(const n of [5,10,13])for(const rate of [.8,.5]){
  const g=create(n);for(let i=0;i<n;i++)g.answerUnits+=rate;g.refreshScore();assert.equal(g.quizScore,4000*rate);
 }
});
test('every subject gets the same full score under its own ideal question count',()=>{
 const idx=read('music-data/index.json'),playlist=makePlaylist(['0001','0002'].map(id=>({id,track:idx[id],chart:read('music-data/'+idx[id].files.chart)}))),plan=sessionPlan(playlist.duration);
 for(const subject of ['japanese','english','math','science','social']){
  const data=read('quiz-data/junior_'+subject+'.json');
  const factory=()=>{const random=seededRandom(21);let h=normalizeHistory(null);const results=new Map();const picker=createAdaptivePicker(makeQuestionQueue(data,random),()=>h,random,()=>results.values());const g=new Game(data,playlist.events,0,random,300,()=>true,picker,297,120);return {g,done:(q,index,time)=>{h=recordAnswer(h,q,{correct:true,time:time*1000,attempt:'q'+index});results.set(index,{question:q,correct:true,wrong:0});}};};
  const ideal=factory(),reference=perfectReference(ideal.g,ideal.done),actual=factory();actual.g.scorePlan=reference;perfectReference(actual.g,actual.done);assert.equal(actual.g.totalScore,10000,subject);assert.equal(actual.g.countedTaps,120,subject);
 }
});
