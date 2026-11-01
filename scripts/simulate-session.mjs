// A reproducible model, not observed user statistics. Run: node scripts/simulate-session.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {Game,makePlaylist,makeQuestionQueue,sessionPlan,SESSION} from '../game.js';
import {normalizeHistory,recordAnswer,createAdaptivePicker} from '../progress.js';
import {DEFAULT_TIMING_OFFSET_MS} from '../calibration.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const index=read('music-data/index.json');
const playlist=makePlaylist(['0001','0002'].map(id=>({id,track:index[id],chart:read('music-data/'+index[id].files.chart)})));
const plan=sessionPlan(playlist.duration);
export function simulateSession(items,seed,retryEvery=0,{missFirst=0,answerDelay=0,acceptQuestion=()=>true}={}){
 const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 let history=normalizeHistory(null);const results=new Map(),seen=new Set();
 const pick=createAdaptivePicker(makeQuestionQueue(items,random,acceptQuestion),()=>history,random,()=>results.values());
 const game=new Game(items,playlist.events,DEFAULT_TIMING_OFFSET_MS/1000,random,plan.endTime,acceptQuestion,pick,plan.fadeStart,SESSION.tapGoal);
 let white=0,color=0,rows=0,taps=0,answerIndex=-1,answerReady=0;const skipped=new Set();
 for(let tick=0;tick<=plan.endTime*60;tick++){
  const now=tick/60;game.update(now);
  for(const note of game.notes){const key=note.id+':'+note.lane;if(seen.has(key))continue;seen.add(key);if(note.color===null){white++;if(white<=missFirst)skipped.add(note.id);}else{color++;if(note.lane===0)rows++;}}
  const q=game.question,occurrence=game.questionIndex,result=results.get(occurrence)||{question:q,wrong:0,correct:false};
  if(game.phase==='answer' && answerIndex!==occurrence){answerIndex=occurrence;answerReady=now+answerDelay;}
  const answerLane=retryEvery && (occurrence+1)%retryEvery===0 && !result.wrong?(q.correct+1)%4:q.correct;
  const note=game.notes.find(n=>!n.done && !skipped.has(n.id) && (n.color===null || now>=answerReady) && n.target<=now && Math.abs(n.target-now)<.08 && (n.color===null || n.lane===answerLane));
  if(!note)continue;
  const correctBefore=game.correctCount,wrongBefore=game.wrongCount;
  game.tap(note.lane,now);taps++;
  if(game.correctCount>correctBefore || game.wrongCount>wrongBefore){
   const correct=game.correctCount>correctBefore;
   history=recordAnswer(history,q,{correct,chosen:q.choices[note.lane],wrongBefore:result.wrong,time:now*1000,attempt:'sim:'+occurrence});
   if(correct)result.correct=true;else result.wrong++;
   results.set(occurrence,result);
  }
 }
 if(!retryEvery && !answerDelay)assert.ok(!['read','answer','feedback'].includes(game.phase),game.phase);
 assert.equal(color,rows*4);
 return {objects:white+color,white,color,colorRows:rows,rows:white+rows,taps,counted:game.countedTaps,missed:game.missedNotes,answers:game.correctCount};
}
const subjects=[['国語','japanese'],['英語','english'],['数学','math'],['理科','science'],['社会','social']];
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)for(const retryEvery of [0,5]){
 const courses=[];const totals=[];
 for(const [subject,file] of subjects){
  const items=[...read('quiz-data/junior_'+file+'.json'),...read('quiz-data/junior_expansion.json').filter(q=>q.subject===subject),...(subject==='英語'?[...read('quiz-data/junior_english_core.json'),...read('quiz-data/junior_english_extended.json')]:[])];
  const results=Array.from({length:100},(_,i)=>simulateSession(items,i+1,retryEvery));totals.push(...results);
  const avg=Object.fromEntries(Object.keys(results[0]).map(key=>[key,Math.round(results.reduce((n,r)=>n+r[key],0)/results.length*10)/10]));
  courses.push({subject,...avg,atGoal:results.filter(r=>r.counted===SESSION.tapGoal).length,minTaps:Math.min(...results.map(r=>r.taps)),maxTaps:Math.max(...results.map(r=>r.taps)),minObjects:Math.min(...results.map(r=>r.objects)),maxObjects:Math.max(...results.map(r=>r.objects))});
 }
 const overall=Object.fromEntries(Object.keys(totals[0]).map(key=>[key,Math.round(totals.reduce((n,r)=>n+r[key],0)/totals.length*10)/10]));
 console.log(JSON.stringify({tapGoal:SESSION.tapGoal,model:retryEvery?'every fifth answer retries once':'all first try, immediate perfect taps',durationSeconds:plan.endTime,runs:totals.length,atGoal:totals.filter(r=>r.counted===SESSION.tapGoal).length,minTaps:Math.min(...totals.map(r=>r.taps)),maxTaps:Math.max(...totals.map(r=>r.taps)),courses,overall},null,2));
}
