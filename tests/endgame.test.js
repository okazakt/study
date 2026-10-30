import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,RULES,makePlaylist,revealPlan} from '../game.js';
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
