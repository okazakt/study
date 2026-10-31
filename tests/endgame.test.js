import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,RULES,makePlaylist,revealPlan,sessionPlan,sessionGain} from '../game.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const items=read('quiz-data/junior_science.json');const tracks=read('music-data/index.json');
const playlist=makePlaylist(Object.entries(tracks).map(([id,track])=>({id,track,chart:read('music-data/'+track.files.chart)})));
const create=(item=items[0])=>new Game([item],playlist.events,0,()=>.5,playlist.duration);
test('admission uses the real beat rows and reserves reading, all taps, feedback and margin',()=>{
 const g=create(),start=8,q=g.question;
 const ready=start+revealPlan(q).duration+RULES.travelSeconds;
 const targets=g.events.filter(e=>e.target>=ready);
 const completion=targets[RULES.tapsToAnswer-1].target+RULES.feedbackSeconds;
 assert.equal(g.earliestCompletion(start),completion);
 g.endTime=completion+.25;g.changePhase('read',start);assert.equal(g.phase,'read');
 const short=create();short.endTime=completion+.249;short.changePhase('read',start);assert.equal(short.phase,'outro');
 const ten=create();ten.question.tapsToAnswer=10;assert.ok(ten.earliestCompletion(start)>completion);
});
test('a multi-blank question is rejected as a whole when only its first answer would fit',()=>{
 const item=items.find(q=>q.blanks.length>1),g=create(item),start=8;
 const firstReady=start+revealPlan(g.question).duration+RULES.travelSeconds;
 const firstDone=g.events.filter(e=>e.target>=firstReady)[2].target+RULES.feedbackSeconds;
 const fullDone=g.earliestCompletion(start);assert.ok(fullDone>firstDone+RULES.readHoldSeconds);
 g.endTime=firstDone+.5;g.changePhase('read',start);assert.equal(g.phase,'outro');assert.equal(g.correctCount,0);
 const full=create(item);full.endTime=fullDone+.25;full.changePhase('read',start);assert.equal(full.phase,'read');
});
test('final seconds stay white through the end, without reopening quizzes or scoring unshown questions',()=>{
 const g=create();const start=playlist.duration-18;g.changePhase('read',start);assert.equal(g.phase,'outro');
 let white=0;
 for(let t=start;t<=playlist.duration;t+=.05){g.update(t);assert.equal(g.phase,'outro');assert.ok(g.notes.every(n=>n.color===null));white+=g.notes.length;}
 assert.ok(white>0);assert.equal(g.quizScore,0);assert.equal(g.correctCount,0);assert.deepEqual(g.counts,[0,0,0,0]);
 const none=create();none.cursor=none.events.length;assert.equal(none.earliestCompletion(20),Infinity);none.changePhase('read',20);assert.equal(none.phase,'outro');
});
test('the first song boundary permits questions that can finish during the second song',()=>{
 const g=create();const now=tracks['0001'].durationSeconds-1;
 assert.ok(g.earliestCompletion(now)>tracks['0001'].durationSeconds);assert.ok(g.earliestCompletion(now)<playlist.duration);
 g.changePhase('read',now);assert.equal(g.phase,'read');
});
test('fast play at 60 fps finishes the full playlist outside reading and answering phases',()=>{
 const all=[...items,...read('quiz-data/junior_english.json'),...read('quiz-data/junior_japanese.json')];
 for(let seed=1;seed<=5;seed++){
  let state=seed;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);
  const g=new Game(all,playlist.events,0,random,playlist.duration);
  for(let now=0;now<playlist.duration;now+=1/60){
   g.update(now);
   const note=g.notes.find(n=>!n.done&&n.target<=now+.008&&Math.abs(n.target-now)<.08&&(n.color===null||n.color===g.question.correct));
   if(note)g.tap(note.lane,now);
  }
  assert.equal(g.phase,'outro',`seed ${seed}`);assert.ok(g.correctCount>0);assert.equal(g.notes.length,0);
 }
});
test('kanji admission reserves every component through the completed glyph',()=>{
 const item=read('quiz-data/junior_japanese.json').find(q=>q.character==='憧');
 const g=new Game([item],playlist.events,0,()=>.5,playlist.duration,q=>q.mode==='kanji_component');
 const start=8,ready=start+revealPlan(g.question).duration+RULES.travelSeconds;
 const firstDone=g.events.filter(e=>e.target>=ready)[2].target+RULES.feedbackSeconds;
 assert.ok(g.earliestCompletion(start)>firstDone+2*RULES.readHoldSeconds);
 g.endTime=firstDone+.5;g.changePhase('read',start);assert.equal(g.phase,'outro');assert.equal(g.correctCount,0);
});


test('sessions cap at five minutes and linearly fade the last three seconds',()=>{
 const plan=sessionPlan(playlist.duration);assert.deepEqual(plan,{endTime:300,fadeStart:297});
 assert.equal(sessionGain(0,plan),1);assert.equal(sessionGain(296,plan),1);assert.equal(sessionGain(297,plan),1);
 assert.equal(sessionGain(298.5,plan),.5);assert.equal(sessionGain(300,plan),0);assert.equal(sessionGain(301,plan),0);
 assert.deepEqual(sessionPlan(playlist.duration,180),{endTime:180,fadeStart:177});
});
test('a playlist within the limit finishes naturally rather than fading early',()=>{
 for(const seconds of [120,300]){const plan=sessionPlan(seconds);assert.equal(plan.endTime,seconds);assert.equal(plan.fadeStart,seconds);assert.equal(sessionGain(seconds-.001,plan),1);assert.equal(sessionGain(seconds,plan),0);}
});
test('quiz admission reserves the fade interval while white notes can continue until the limit',()=>{
 const g=create();g.endTime=300;g.questionEndTime=297;
 const now=Array.from({length:3000},(_,i)=>i/10).find(now=>g.earliestCompletion(now)>297 && g.earliestCompletion(now)+.25<=300);
 assert.ok(Number.isFinite(now));
 const normal=create();normal.endTime=300;normal.changePhase('read',now);assert.equal(normal.phase,'read');
 g.changePhase('read',now);assert.equal(g.phase,'outro');
 let seen=0;for(let t=297;t<=300;t+=1/60){g.update(t);seen+=g.notes.length;for(const note of g.notes)assert.ok(note.target+RULES.goodWindow+RULES.judgmentSeconds<=300);}
 assert.ok(seen>0);
});
test('all phases avoid generating notes whose judgment display would cross the session end',()=>{
 for(const phase of ['answer','rhythm','outro']){
  const g=create();g.endTime=300;g.changePhase(phase,296);
  for(let t=296;t<=300.01;t+=1/60){g.update(t);for(const note of g.notes)assert.ok(note.target+RULES.goodWindow+RULES.judgmentSeconds<=300);}
  assert.equal(g.notes.length,0);
 }
});
