import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,RULES,SPEEDS,RHYTHMS,normalizeGameplayOptions,revealPlan,makeQuestionQueue,sessionMusic,seededRandom,perfectReference} from '../game.js';
import {normalizeHistory,recordAnswer,createAdaptivePicker} from '../progress.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const math=read('quiz-data/junior_math.json');
const beats=Array.from({length:601},(_,i)=>({time:i*.5,type:'beat',bar:Math.floor(i/4),beatInBar:i%4+1}));
function create(options={}){return new Game(math,beats,0,seededRandom(91),300,()=>true,null,297,RHYTHMS[options.rhythm||'easy'].tapGoal,options);}
test('gameplay defaults preserve slow and easy and reject unknown saved values',()=>{
 assert.deepEqual(normalizeGameplayOptions(null),{speed:'slow',rhythm:'easy'});
 assert.deepEqual(normalizeGameplayOptions({speed:'invalid',rhythm:'hard'}),{speed:'slow',rhythm:'hard'});
 assert.deepEqual(Object.values(RHYTHMS).map(r=>r.tapGoal),[120,180,240]);
});
test('approved reading speeds use total visible text, exact midpoint and an included lift',()=>{
 for(const q of makeQuestionQueue(math)){
  const slow=revealPlan(q),normal=revealPlan(q,'normal'),fast=revealPlan(q,'fast'),instant=revealPlan(q,'instant');
  const n=Array.from((q.task||'')+q.prompt+q.choices.join('')).length;
  assert.equal(fast.duration,n/12);assert.equal(instant.duration,n/20);assert.equal(normal.duration,(slow.duration+fast.duration)/2);
  assert.ok(slow.duration>normal.duration&&normal.duration>fast.duration&&fast.duration>instant.duration);
  assert.equal(fast.liftStart+(q.continuation?0:.35),fast.duration);assert.equal(fast.revealEnd,0);
  assert.ok(fast.choices.every(c=>c.start===0&&c.end===0));assert.equal(instant.instant,true);
  assert.ok(normal.charSeconds<RULES.charSeconds);assert.ok(normal.fadeSeconds<RULES.fadeSeconds);
  if(q.continuation){assert.deepEqual(normal.prompt,{start:0,end:0});assert.equal(normal.liftStart,normal.duration);}
 }
});
test('answer phase begins at the selected reading deadline, never before it',()=>{
 for(const speed of Object.keys(SPEEDS)){
  const g=create({speed});g.changePhase('read',8);const end=8+g.reveal.duration;
  g.update(end-.001);assert.equal(g.phase,'read');g.update(end);assert.equal(g.phase,'answer');
 }
});
test('normal and hard rows each contain all colors, and taps answer by color rather than lane',()=>{
 for(const rhythm of ['normal','hard']){
  const g=create({rhythm,speed:'instant'});g.changePhase('read',0);g.changePhase('answer',0);
  let moved=false;
  for(let i=0;i<3;i++){
   g.update(i?g.time:1.8);let note=g.notes.filter(n=>!n.done&&n.color===g.question.correct).sort((a,b)=>a.target-b.target)[0];
   const row=g.notes.filter(n=>n.rowId===note.rowId&&!n.done);assert.deepEqual(new Set(row.map(n=>n.color)),new Set([0,1,2,3]));
   assert.equal(new Set(row.map(n=>n.lane)).size,4);moved ||= row.some(n=>n.lane!==n.color);
   g.tap(note.lane,note.target);
  }
  assert.ok(moved);assert.equal(g.correctCount,1);assert.equal(g.quizResult.choice,g.question.correct);
 }
});
test('hard answer pattern uses musical half-beats and unequal gaps, easy and normal keep main beats',()=>{
 for(const rhythm of Object.keys(RHYTHMS)){
  const g=create({rhythm});const targets=g.events.filter(e=>g.answerEvent(e)).map(e=>e.target),gaps=targets.slice(1,20).map((t,i)=>t-targets[i]);
  if(rhythm==='hard'){assert.ok(new Set(gaps).size>1);assert.ok(g.events.some(e=>e.half&&g.answerEvent(e)));assert.ok(Math.min(...gaps)>=.25);}
  else{assert.deepEqual(new Set(gaps),new Set([.5]));assert.ok(g.events.filter(e=>g.answerEvent(e)).every(e=>!e.half));}
 }
});
test('all speed and rhythm combinations reach their goal under ideal play and higher rhythm gives higher combo rewards',()=>{
 const idx=read('music-data/index.json'),entries=Object.entries(idx).map(([id,track])=>({id,track,chart:read('music-data/'+track.files.chart)}));
 for(const subject of ['math','science','english','japanese','social'])for(const speed of Object.keys(SPEEDS))for(const rhythm of Object.keys(RHYTHMS)){
  const items=read('quiz-data/junior_'+subject+'.json'),playlist=sessionMusic(entries,null,seededRandom(101));
  const factory=()=>{
   const random=seededRandom(87);let history=normalizeHistory(null);const results=new Map();
   const pick=createAdaptivePicker(makeQuestionQueue(items,random),()=>history,random,()=>results.values());
   const g=new Game(items,playlist.events,-.101,random,300,()=>true,pick,297,RHYTHMS[rhythm].tapGoal,{speed,rhythm});
   return {g,done:(q,index,time)=>{history=recordAnswer(history,q,{correct:true,chosen:q.answer,time:time*1000,attempt:'sim:'+index});results.set(index,{question:q,correct:true,wrong:0});}};
  };
  const ideal=factory(),reference=perfectReference(ideal.g,ideal.done),actual=factory();actual.g.scorePlan=reference;perfectReference(actual.g,actual.done);
  const label=`${subject}/${speed}/${rhythm}`,goal=RHYTHMS[rhythm].tapGoal;
  assert.equal(actual.g.countedTaps,goal,label);assert.equal(actual.g.maxCombo,goal,label);
  assert.equal(actual.g.whiteComboBonus+actual.g.colorComboBonus,goal*(goal+1)/2,label);
  assert.equal(actual.g.totalScore,10000+goal*(goal+1)/2+actual.g.firstCount*(actual.g.firstCount+1)*5,label);
  assert.ok(!['read','answer'].includes(actual.g.phase),label);
 }
});
