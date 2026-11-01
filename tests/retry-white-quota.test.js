import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,makeQuestionQueue,RHYTHMS} from '../game.js';
const word=JSON.parse(readFileSync(new URL('../quiz-data/junior_english_core.json',import.meta.url))).find(q=>q.english==='father');
const q=makeQuestionQueue([word],()=>.5,q=>q.mode==='to_japanese')[0];
const events=Array.from({length:600},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,type:'beat'}));
function create(rhythm='normal'){return new Game([],events,0,()=>.5,300,()=>true,()=>[q],297,RHYTHMS[rhythm].tapGoal,{speed:'instant',rhythm});}
function answer(g,errors=0){g.events=create(g.options.rhythm).events;g.cursor=0;g.changePhase('read',0);g.changePhase('answer',0);g.events=[];let now=2;
 for(let attempt=0;attempt<=errors;attempt++)for(let i=0;i<3;i++){const lane=attempt<errors?(q.correct+1)%4:q.correct;g.notes=[{target:now,lane,color:lane}];g.tap(lane,now);now+=.5;}
 return now;
}
test('only the initial required color rows spend the quota, including misses; retry hits remain real judgments',()=>{
 const g=create();answer(g,2);assert.equal(g.countedTaps,9);assert.equal(g.quotaTaps,3);assert.equal(g.extraColorJudgments,6);assert.equal(g.wrongCount,2);assert.equal(g.correctCount,1);assert.equal(g.combo,3);
 const missed=create();missed.changePhase('answer',0);missed.events=[];
 for(let i=0;i<6;i++){missed.notes=[0,1,2,3].map(lane=>({target:2+i,lane,color:lane,rowId:i}));missed.update(2+i+.17);}
 assert.equal(missed.missedNotes,6);assert.equal(missed.quotaTaps,3);assert.equal(missed.judgments.MISS,6);assert.equal(missed.combo,0);
});
test('white misses spend the quota and empty presses spend none',()=>{
 const g=create();g.changePhase('outro',0);g.events=[];
 g.notes=[{target:2,lane:0,color:null}];g.update(2.17);assert.equal(g.quotaTaps,1);
 g.tap(0,3);assert.equal(g.quotaTaps,1);assert.equal(g.emptyMisses,1);
});
test('retry rows no longer thin the next white section and elapsed retry time raises density',()=>{
 for(const rhythm of ['normal','hard']){
  const first=create(rhythm),retry=create(rhythm);answer(first);answer(retry,2);
  first.events=create(rhythm).events;retry.events=create(rhythm).events;first.cursor=retry.cursor=0;
  first.changePhase('rhythm',15);retry.changePhase('rhythm',18);
  assert.ok(retry.whiteTargets.size>=first.whiteTargets.size, rhythm);
  assert.ok(retry.whiteTargets.size>=6,rhythm+': '+retry.whiteTargets.size);
 }
});
test('extra colors do not suppress remaining whites once the real judgment count exceeds the goal',()=>{
 const g=create();g.judgments.PERFECT=185;g.extraColorJudgments=15;g.changePhase('outro',280);
 assert.equal(g.quotaTaps,170);assert.equal(g.whiteTargets.size,10);
 for(let tick=280*60;tick<=300*60;tick++){const t=tick/60;g.update(t);const n=g.notes.find(n=>n.target<=t&&n.target>=t-.08);if(n)g.tap(n.lane,t);}
 assert.equal(g.quotaTaps,180);assert.equal(g.countedTaps,195);
});
test('each new stage has its own allowance and a late answer may leave fewer white slots than needed',()=>{
 const g=create();answer(g,1);assert.equal(g.quotaTaps,3);
 g.changePhase('read',10);answer(g);assert.equal(g.quotaTaps,6);assert.equal(g.countedTaps,9);
 const late=create();late.judgments.PERFECT=120;late.extraColorJudgments=30;late.changePhase('outro',298);
 assert.equal(late.whiteTargets.size,0);assert.ok(late.quotaTaps<late.tapGoal);
});
