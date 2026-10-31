import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,SCORE,seededRandom,perfectReference,makeQuestionQueue,makePlaylist,sessionPlan,sessionMusic} from '../game.js';
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
  g.judgments.PERFECT=g.whiteJudgments+g.colorUnits;g.refreshScore();assert.equal(g.totalScore,10000);assert.deepEqual(g.scoreBreakdown,{white:5000,color:1000,netWhite:5000,netColor:1000,baseAnswer:4000,answer:4000,whiteBonus:0,colorBonus:0,answerBonus:0,penalty:0,rhythm:6000,total:10000});
 }
});
test('answer points use 100, 80, 50, and zero percent after confirmed wrong answers',()=>{
 for(const [errors,points] of [[0,4000],[1,3200],[2,2000],[3,0],[4,0]]){
  const g=create();answer(g,errors);assert.equal(g.quizScore,points+(errors===0?10:0));assert.equal(g.wrongCount,errors);assert.equal(g.correctCount,1);
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
 assert.equal(g.colorUnits,0);assert.equal(g.scoreBreakdown.color,0);assert.equal(g.quizScore,4010);assert.equal(g.countedTaps,6);
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
 b.g.scorePlan=reference;assert.deepEqual(perfectReference(b.g,b.done),reference);assert.equal(b.g.totalScore,10000+b.g.whiteComboBonus+b.g.colorComboBonus+b.g.answerComboBonus);
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
  const ideal=factory(),reference=perfectReference(ideal.g,ideal.done),actual=factory();actual.g.scorePlan=reference;perfectReference(actual.g,actual.done);assert.equal(actual.g.totalScore,10000+actual.g.whiteComboBonus+actual.g.colorComboBonus+actual.g.answerComboBonus,subject);assert.equal(actual.g.countedTaps,120,subject);
 }
});

test('displayed white and color scores include empty-miss deductions and add up to total',()=>{
 const g=create(8);g.scorePlan={questions:8,white:96,color:24};
 g.whiteJudgments=82;g.whiteUnits=69;g.colorUnits=21;g.answerUnits=7.1;
 g.judgments.PERFECT=92;g.judgments.GOOD=22;g.missedNotes=6;g.emptyMisses=3;g.refreshScore();
 const s=g.scoreBreakdown;
 assert.equal(s.netWhite,3505);assert.equal(s.netColor,854);assert.equal(s.answer,3550);
 assert.equal(s.total,7909);assert.equal(s.netWhite+s.whiteBonus+s.netColor+s.colorBonus+s.answer,g.totalScore);
});
test('deducted component scores remain nonnegative and consistent at zero and extreme empty misses',()=>{
 const g=create();
 for(const empty of [0,1,100000])for(const units of [0,.5,1]){
  g.emptyMisses=empty;g.whiteUnits=units;g.colorUnits=units;g.judgments.PERFECT=units?2:0;
  const s=g.scoreBreakdown;assert.ok(s.netWhite>=0);assert.ok(s.netColor>=0);
  assert.equal(s.netWhite+s.whiteBonus+s.netColor+s.colorBonus+s.answer,s.total);
 }
});

test('normalized scoring adds the current rhythm combo for GOOD and PERFECT and stops after color capacity',()=>{
 const g=create();g.changePhase('outro',0);
 g.notes=[{target:2,lane:0,color:null}];g.tap(0,2.12);
 g.notes=[{target:3,lane:0,color:null}];g.tap(0,3);
 assert.equal(g.whiteComboBonus,3);
 g.changePhase('read',3);g.changePhase('answer',3);
 const wrong=(g.question.correct+1)%4;
 for(let i=0;i<3;i++){g.notes=[{target:5+i,lane:wrong,color:wrong}];g.tap(wrong,5+i);}
 assert.equal(g.colorComboBonus,3+4+5);assert.equal(g.combo,0);
 for(let i=0;i<3;i++){const lane=g.question.correct;g.notes=[{target:9+i,lane,color:lane}];g.tap(lane,9+i);}
 assert.equal(g.colorComboBonus,12);assert.equal(g.answerComboBonus,0);
 const s=g.scoreBreakdown;assert.equal(s.netWhite+s.whiteBonus+s.netColor+s.colorBonus+s.answer,g.totalScore);
});
test('first-try correct answers add quiz combo times ten and wrong answers restart the streak',()=>{
 const g=create();g.quizCombo=2;answer(g);assert.equal(g.quizCombo,3);assert.equal(g.answerComboBonus,30);assert.equal(g.quizScore,4030);
 const retry=create();retry.quizCombo=2;answer(retry,1);assert.equal(retry.quizCombo,0);assert.equal(retry.answerComboBonus,0);assert.equal(retry.quizScore,3200);
});

test('random and repeated real-song playlists support 120 perfect taps plus both combo bonuses',()=>{
 const idx=read('music-data/index.json'),entries=['0001','0002'].map(id=>({id,track:idx[id],chart:read('music-data/'+idx[id].files.chart)}));
 for(const [fixed,random] of [['',()=>0],['',()=>.99],['0001',()=>0],['0002',()=>0]]){
  const playlist=sessionMusic(entries,fixed,random);
  const factory=()=>new Game(items,playlist.events,0,seededRandom(123),300,()=>true,null,297,120);
  const reference=perfectReference(factory()),g=factory();g.scorePlan=reference;perfectReference(g);
  assert.equal(g.countedTaps,120);assert.equal(g.maxCombo,120);
  assert.equal(g.whiteComboBonus+g.colorComboBonus,120*121/2);
  assert.equal(g.answerComboBonus,g.firstCount*(g.firstCount+1)*5);
  assert.equal(g.totalScore,10000+7260+g.answerComboBonus);
 }
});
