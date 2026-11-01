import test from 'node:test';import assert from 'node:assert/strict';
import {FocusGame,focusReveal} from '../focus-game.js';
import {RHYTHMS,normalizeGameplayOptions,makeQuestionQueue} from '../game.js';
const item={id:'focus-test',school_level:'中学',grade:'中1',subject:'英語',field:'英単語',english:'cat',japanese:'猫',english_dummies:['dog','bird','fish'],japanese_dummies:['犬','鳥','魚'],spelling:[{index:1,answer:'cat',dummies:['cut','cot','cit']}],spelling_template:'{{1}}',note:'猫'};
const events=Array.from({length:120},(_,i)=>({time:i*.5+1,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0}));
const make=(speed='instant')=>new FocusGame([item],events,0,()=>.5,60,q=>q.mode==='to_japanese',null,60,null,{rhythm:'focus',speed});
test('focus is a saved fourth option and no notes or white interludes are created',()=>{
 assert.equal(Object.keys(RHYTHMS).length,4);assert.equal(normalizeGameplayOptions({rhythm:'focus'}).rhythm,'focus');
 const g=make();g.update(0);assert.equal(g.phase,'answer');assert.equal(g.requiredTaps,1);assert.equal(g.notes.length,0);
 g.tap(g.question.correct,1);assert.equal(g.correctCount,1);assert.equal(g.phase,'feedback');assert.equal(g.nextQuestionAt,2);
 g.update(1.5);assert.equal(g.phase,'feedback');g.update(2);assert.equal(g.phase,'answer');assert.equal(g.questionIndex,1);assert.equal(g.notes.length,0);
});
test('waiting and answer share each beat; duplicate and offbeat presses miss, wrong answers break both combos',()=>{
 const g=make();g.update(0);g.tap(-1,1);assert.equal(g.combo,1);assert.equal(g.lastJudgment,'PERFECT');
 g.tap(-1,1);assert.equal(g.lastJudgment,'MISS');assert.equal(g.combo,0);
 const wrong=(g.question.correct+1)%4;g.tap(wrong,1.5);assert.equal(g.wrongCount,1);assert.equal(g.combo,0);assert.equal(g.phase,'answer');
 g.tap(g.question.correct,1.76);assert.equal(g.correctCount,1);assert.equal(g.lastJudgment,'MISS');assert.equal(g.firstCount,0);assert.equal(g.quizScore,40);
});
test('skipped beats count once even while reading or giving feedback; good and great preserve combos',()=>{
 const g=make('slow');g.tap(-1,1.1);assert.equal(g.lastJudgment,'GOOD');assert.equal(g.combo,1);assert.equal(g.phase,'read');
 assert.equal(g.tap(0,1.2),null);g.update(2.2);assert.equal(g.missedNotes,2);assert.equal(g.combo,0);g.update(2.3);assert.equal(g.missedNotes,2);
 g.tap(-1,2.5);assert.equal(g.lastJudgment,'PERFECT');assert.equal(g.combo,1);
});
test('animated speeds preserve ordered character reveals and instant has no wait',()=>{
 const q=makeQuestionQueue([item],()=>.5)[0];const plans=['slow','normal','fast','instant'].map(s=>focusReveal(q,s));
 assert.ok(plans[0].duration>plans[1].duration);assert.ok(plans[1].duration>plans[2].duration);assert.equal(plans[2].charSeconds,1/12);assert.equal(plans[3].duration,0);
 for(const p of plans.slice(0,3)){assert.equal(p.instant,false);assert.ok(p.choices[1].start>p.choices[0].start);assert.equal(p.liftSeconds,0);}
});
test('every blank completes in order and the final incomplete unit is not admitted',()=>{
 const g=new FocusGame([item],events,0,()=>.5,60,q=>q.mode==='spelling',null,60,null,{speed:'instant'});g.update(0);
 assert.equal(g.question.mode,'spelling');g.tap(g.question.correct,1);assert.equal(g.correctCount,1);g.update(2);assert.equal(g.phase,'answer');
 const short=new FocusGame([item],events,0,()=>.5,1.2,q=>q.mode==='to_japanese',null,1.2,null,{speed:'instant'});assert.equal(short.phase,'outro');
});
test('five minute focus progression uses no notes, advances multiple blanks, and bounds score after retries',()=>{
 const longEvents=Array.from({length:600},(_,i)=>({time:i*.5+.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0}));
 const g=new FocusGame([item],longEvents,0,()=>.5,300,q=>q.mode==='to_japanese',null,297,null,{speed:'instant'});
 for(const e of g.beats){g.update(e.target);g.tap(g.phase==='answer'?g.question.correct:-1,e.target);assert.equal(g.notes.length,0);}
 assert.ok(g.correctCount>100);assert.equal(g.wrongCount,0);assert.ok(g.scoreBreakdown.netWhite>0);assert.equal(g.totalScore,g.rhythmScore+g.quizScore);
 const retry=make();retry.update(0);for(let i=0;i<3;i++)retry.tap((retry.question.correct+1)%4,1+i*.5);
 const colorBefore=retry.focusColor;retry.tap(retry.question.correct,2.5);assert.equal(retry.quizScore,0);assert.equal(retry.focusColor,colorBefore);
});

test('multiple explanation blanks retain the same source until the last blank is solved',()=>{
 const point={id:'two-holes',term:'test',term_dummies:['a','b','c'],explanation_template:'{{1}}と{{2}}',blanks:[{index:1,answer:'甲',dummies:['乙','丙','丁']},{index:2,answer:'乙',dummies:['甲','丙','丁']}],note:'test'};
 const g=new FocusGame([point],events,0,()=>.5,60,q=>q.mode==='term_to_explanation',null,60,null,{speed:'instant'});g.update(0);
 assert.equal(g.question.blankPosition,1);g.tap(g.question.correct,1);g.update(2);assert.equal(g.question.blankPosition,2);assert.equal(g.question.sourceId,point.id);assert.equal(g.question.continuation,true);
 g.tap(g.question.correct,2);assert.equal(g.correctCount,2);assert.equal(g.phase,'feedback');
});

test('an early accepted answer still leaves two full subsequent beats for correct feedback',()=>{
 const g=make();g.update(0);g.tap(g.question.correct,.95);assert.equal(g.nextQuestionAt,2);g.update(1.5);assert.equal(g.phase,'feedback');g.update(2);assert.equal(g.questionIndex,1);
});

test('focus cadence respects tempo, triple meter and explicit compatible track settings',async()=>{
 const {focusBeatDivisor}=await import('../game.js');
 assert.equal(focusBeatDivisor({baseBpm:60}),1);assert.equal(focusBeatDivisor({baseBpm:120}),2);assert.equal(focusBeatDivisor({baseBpm:180}),4);
 assert.equal(focusBeatDivisor({baseBpm:100},{timeSignature:'3/4'}),3);
 assert.equal(focusBeatDivisor({baseBpm:180,focusRhythm:{beatDivisor:2}}),2);
 assert.equal(focusBeatDivisor({focusRhythm:{beatDivisor:2}},{timeSignature:'3/4'}),3);
});
test('half cadence has no misses on omitted beats, pulses only assigned beats and keeps feedback two musical beats',()=>{
 const sparse=events.map(e=>({...e,focusEligible:e.beatInBar%2===1}));
 const g=new FocusGame([item],sparse,0,()=>.5,60,q=>q.mode==='to_japanese',null,60,null,{speed:'instant'});
 g.update(0);assert.equal(g.beats.length,g.musicBeats.length/2);g.tap(-1,1);g.update(1.7);assert.equal(g.missedNotes,0);assert.equal(g.pulse(1.5),0);
 g.tap(g.question.correct,2);assert.equal(g.nextQuestionAt,3);g.update(3);assert.equal(g.questionIndex,1);
 g.update(4.2);assert.equal(g.missedNotes,2);
});
test('both registered songs use half cadence through the real playlist while ordinary beat timestamps remain intact',async()=>{
 const {readFileSync}=await import('node:fs'),{makePlaylist}=await import('../game.js');const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
 const catalog=read('music-data/index.json'),entries=Object.entries(catalog).map(([id,track])=>({id,track,chart:read('music-data/'+track.files.chart)}));
 const list=makePlaylist(entries);for(const t of list.tracks){assert.equal(t.focusRhythm.beatDivisor,2);assert.ok(t.events.some(e=>!e.focusEligible));assert.ok(t.events.every(e=>e.focusEligible===(e.beatInBar%2===1)));}
 const g=new FocusGame([item],list.events,-.101,()=>.5,list.duration,q=>q.mode==='to_japanese',null,list.duration,null,{speed:'instant'});
 assert.ok(g.beats.length<g.musicBeats.length*.52);assert.ok(g.beats.length>g.musicBeats.length*.48);
 assert.equal(g.beats[0].target,list.events.find(e=>e.focusEligible).time-.101);
});
