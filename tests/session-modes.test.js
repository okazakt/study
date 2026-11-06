import test from 'node:test';import assert from 'node:assert/strict';
import {Game,appendRandomTrack,makePlaylist,normalizeGameplayOptions} from '../game.js';
import {FocusGame} from '../focus-game.js';
import {createAdaptivePicker,normalizeHistory,recordAnswer,questionKey} from '../progress.js';
const item={id:'modes',kind:'choice',school_level:'中学',subject:'英語',grade:'中1',field:'英文法',unit:'test',task:'選ぼう',prompt:'test',answer:'a',dummies:['b','c','d'],note:'test'};
const chartEvents=(start=1,count=800)=>Array.from({length:count},(_,i)=>({time:start+i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0}));
const q=id=>({...item,id,sourceId:id,mode:'learning_point',choices:['a','b','c','d'],correct:0});
test('old gameplay settings migrate and invalid new settings fall back',()=>{
 assert.deepEqual(normalizeGameplayOptions({speed:'fast',rhythm:'focus'}),{speed:'fast',rhythm:'focus',duration:'five',balance:'normal'});
 assert.equal(normalizeGameplayOptions({duration:'endless',balance:'review'}).duration,'endless');
 assert.equal(normalizeGameplayOptions({duration:'bad',balance:'bad'}).balance,'normal');
});
test('unanswered preference includes unplayed reverse directions and exhausts them before known questions',()=>{
 const fresh=q('fresh'),known=q('known');let state=recordAnswer(normalizeHistory(null),known,{correct:true,chosen:'a',time:1});
 const pick=createAdaptivePicker([fresh,known],()=>state,()=>.999,null,'unanswered');
 assert.equal(pick()[0].sourceId,'fresh');
 state=recordAnswer(state,fresh,{correct:true,chosen:'a',time:2});assert.ok(['fresh','known'].includes(pick()[0].sourceId));
});
test('review priority overrides fresh-session avoidance and stops prioritizing three consecutive successes',()=>{
 const wrong=q('wrong'),fresh=q('fresh');let state=recordAnswer(normalizeHistory(null),wrong,{correct:false,chosen:'b',time:1});
 const pick=createAdaptivePicker([fresh,wrong],()=>state,()=>.5,()=>[],'review');
 assert.equal(pick()[0].sourceId,'wrong');assert.equal(pick()[0].sourceId,'wrong');
 for(let i=0;i<3;i++)state=recordAnswer(state,wrong,{correct:true,chosen:'a',time:i+2,attempt:'ok'+i});
 assert.equal(pick()[0].sourceId,'fresh');assert.equal(state.questions[questionKey(wrong)].recent.length,3);
});
test('review preference never splits a multi-blank question',()=>{
 const first=q('multi'),second={...first,id:'second',blankIndex:2,continuation:true};first.blankIndex=1;
 const state=recordAnswer(normalizeHistory(null),second,{correct:false,chosen:'b',time:1});
 assert.equal(createAdaptivePicker([first,second,q('fresh')],()=>state,()=>0,null,'review')().length,2);
});
test('a live endless playlist adds a random different song on the same trimmed corrected timeline',()=>{
 const entries=['a','b'].map(id=>({id,track:{durationSeconds:100,timing:{chartToAudioOffsetMs:100},files:{audio:id+'.mp3'},playback:{startSeconds:1,endSeconds:99}},chart:{events:chartEvents(1,190)}}));
 const list=makePlaylist([entries[0]]);list.tracks[0].playNumber=1;
 const song=appendRandomTrack(list,entries,null,()=>0);assert.equal(song.id,'b');assert.equal(song.start,98);assert.equal(song.playNumber,2);
 assert.ok(Math.abs(song.events[0].time-98.1)<1e-8);
 list.tracks.splice(0,1);const next=appendRandomTrack(list,entries,null,()=>0);assert.equal(next.id,'a');assert.equal(next.playNumber,3);assert.equal(next.start,196);
 const fixed=appendRandomTrack(list,entries,['b'],()=>0);assert.equal(fixed.id,'b');
});
test('normal and focus endless games accept chart extensions and continue past 5 minutes',()=>{
 for(const Type of [Game,FocusGame]){
  const g=new Type([item],chartEvents(1,200),0,()=>.5,Infinity,()=>true,null,Infinity,null,{speed:'instant',duration:'endless'});
  g.appendEvents(chartEvents(101,800));assert.equal(new Set(g.events.map(e=>e.id)).size,g.events.length);
  g.changePhase('read',301);g.update(301+g.reveal.duration);assert.equal(g.phase,'answer');assert.equal(g.endTime,Infinity);assert.equal(g.tapGoal,null);assert.equal(g.notes.every(n=>n.target>300),true);
  if(g.focus){g.tap(g.question.correct,301.5);assert.equal(g.correctCount,1);assert.equal(g.scoreBreakdown.answerBonus,10);}
  else assert.ok(g.scoreBreakdown);
  g.finish();assert.equal(g.phase,'ended');
 }
});
test('endless scoring caps retry color rewards but keeps timing/combo judgments',()=>{
 const g=new Game([item],chartEvents(),0,()=>.5,Infinity,()=>true,null,Infinity,null,{speed:'instant',duration:'endless'});
 g.changePhase('answer',0);const wrong=(g.question.correct+1)%4;
 const hit=(lane,time)=>{g.notes=[{lane,color:lane,target:time,rowId:'test'+time,done:false}];g.tap(lane,time);};
 for(let i=0;i<3;i++)hit(wrong,1+i*.5);
 assert.equal(g.wrongCount,1);assert.equal(g.combo,0);const color=g.colorUnits,bonus=g.colorComboBonus;
 for(let i=0;i<3;i++)hit(g.question.correct,3+i*.5);
 assert.equal(g.correctCount,1);assert.equal(g.colorUnits,color);assert.equal(g.colorComboBonus,bonus);assert.equal(g.combo,3);assert.equal(g.scoreBreakdown.baseAnswer,40);
});
test('a focus answer near the end of available beats resumes after a later chart extension',()=>{
 const g=new FocusGame([item],chartEvents(1,2),0,()=>.5,Infinity,()=>true,null,Infinity,null,{speed:'instant',duration:'endless'});
 g.update(0);g.tap(g.question.correct,1);assert.equal(g.nextQuestionAt,Infinity);
 g.appendEvents(chartEvents(2,20));g.update(2);assert.equal(g.questionIndex,1);assert.equal(g.phase,'answer');assert.equal(g.correctCount,1);
});
