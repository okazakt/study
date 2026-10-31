import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHistory,recordAnswer,buildPriorityIndex,priorityCategory,createAdaptivePicker,questionCoverage,questionKey} from '../progress.js';
import {makeQuestionQueue,Game,RULES} from '../game.js';
const base={id:'sample',sourceId:'sample',mode:'explanation_to_term',school_level:'中学',grade:'中2',subject:'数学',answer:'正解',choices:['正解','A','B','C'],correct:0,prompt:'本文'};
const inverse=q=>({...q,id:q.id+':blank',mode:'term_to_explanation',blankIndex:1});
function seeded(seed=17){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function category(q,state){return priorityCategory(q,buildPriorityIndex(state));}
function record(state,q,correct,attempt,wrongBefore=0,kind='play'){return recordAnswer(state,q,{correct,attempt,wrongBefore,kind});}
function candidates(){
 let state=normalizeHistory(null);const qs=[];
 for(let group=1;group<=6;group++)for(let n=0;n<5;n++){
  const q={...base,id:`g${group}-${n}`,sourceId:`g${group}-${n}`,group};qs.push(q);
  if(group===2)state=record(state,inverse(q),false,'reverse');
  if(group===3)state=record(state,inverse(q),true,'reverse');
  if(group===4)state=record(state,q,false,'failed');
  if(group===5)state=record(state,q,true,'passed');
  if(group===6)for(let i=0;i<3;i++)state=record(state,q,true,'mastered'+i);
 }
 return {state,qs};
}
test('six categories distinguish unseen reverse variants, errors and stable success',()=>{
 const {state,qs}=candidates();for(const q of qs)assert.equal(category(q,state),q.group);
 let retried=record(state,qs[20],false,'next');retried=record(retried,qs[20],true,'next',1);assert.equal(category(qs[20],retried),4);
 for(let i=0;i<3;i++)retried=record(retried,qs[20],true,'later'+i);assert.equal(category(qs[20],retried),6);
 retried=record(retried,qs[20],false,'latest');assert.equal(category(qs[20],retried),4);
});
test('abundant candidates approach 35:25:18:15:5:2 while excluding recent three sources',()=>{
 const {state,qs}=candidates(),pick=createAdaptivePicker(qs,()=>state,seeded());const counts=[0,0,0,0,0,0],recent=[];
 for(let i=0;i<20000;i++){
  const [q]=pick();assert.ok(!recent.includes(q.sourceId));recent.push(q.sourceId);if(recent.length>3)recent.shift();
  counts[q.group-1]++;assert.equal(q.choices[q.correct],q.answer);
 }
 for(const [i,weight] of [35,25,18,15,5,2].entries())assert.ok(Math.abs(counts[i]/200-weight)<1,JSON.stringify(counts));
});
test('empty categories renormalize weights, live history updates classification and small decks relax only as needed',()=>{
 const {state,qs}=candidates(),limited=qs.filter(q=>[2,6].includes(q.group));const pick=createAdaptivePicker(limited,()=>state,seeded());let count=0;
 for(let i=0;i<10000;i++)if(pick()[0].group===2)count++;
 assert.ok(Math.abs(count/10000-25/27)<.02);
 let history=normalizeHistory(null);const one={...base};const single=createAdaptivePicker([one],()=>history,seeded());assert.equal(category(single()[0],history),1);
 history=record(history,one,false,'first');assert.equal(category(single()[0],history),4);
 const pair=createAdaptivePicker([base,{...base,sourceId:'other'}],()=>history,seeded());let last='';for(let i=0;i<20;i++){const q=pair()[0];assert.notEqual(q.sourceId,last);last=q.sourceId;}
});
test('multi-stage units remain complete and use their most urgent stage category',()=>{
 const first={...base,mode:'term_to_explanation',blankIndex:1},second={...first,blankIndex:2,continuation:true};
 let state=normalizeHistory(null);for(let i=0;i<3;i++)state=record(state,first,true,'solved'+i);
 const pick=createAdaptivePicker([first,second],()=>state,seeded());const chosen=pick();assert.equal(chosen.length,2);assert.equal(chosen[1].continuation,true);
 assert.equal(Math.min(...chosen.map(q=>category(q,state))),1);
 const game=new Game([],[],0,seeded(),Infinity,()=>true,pick);game.changePhase('answer',0);
 let now=2;for(let step=0;step<2;step++){
  for(let n=0;n<3;n++){game.notes.push({target:now,lane:game.question.correct,color:game.question.correct});game.tap(game.question.correct,now++);}
  now+=RULES.feedbackSeconds;game.update(now);
  if(step===0){assert.equal(game.question.blankIndex,2);assert.equal(game.reveal.continuation,true);now+=game.reveal.duration;game.update(now);}
 }
 assert.equal(game.correctCount,2);assert.ok(game.questions.length>2);
});
test('adaptive unit admission still reserves all stages before the song ends',()=>{
 const item=JSON.parse(readFileSync(new URL('../quiz-data/junior_math.json',import.meta.url))).find(q=>q.blanks.length===2);
 const unit=makeQuestionQueue([item],()=>.5).filter(q=>q.mode==='term_to_explanation');
 const events=Array.from({length:300},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,type:'beat'}));
 const g=new Game([],events,0,seeded(),150,()=>true,()=>unit.map(q=>({...q})));
 const time=g.earliestCompletion(10);g.endTime=time-.1;g.changePhase('read',10);assert.equal(g.phase,'outro');
});
test('coverage counts direction and hole keys once, including wrong-only and review answers',()=>{
 const q=base,rev=inverse(base),second={...rev,blankIndex:2};let state=normalizeHistory(null);
 state=record(state,q,false,'one');state=record(state,q,true,'one',1);state=record(state,rev,true,'review',0,'review');
 assert.deepEqual(questionCoverage([q,rev,second,q],state),{solved:2,total:3});
 const item=JSON.parse(readFileSync(new URL('../quiz-data/junior_math.json',import.meta.url)));assert.equal(questionCoverage(makeQuestionQueue(item),state).total,25);
});
test('older records reconstruct repeated mistakes as one failure and migrate known recent success',()=>{
 let old=normalizeHistory(null);
 old=record(old,base,false,'legacy');old=record(old,base,false,'legacy',1);old=record(old,base,true,'legacy',2);
 for(let i=0;i<2;i++)old=record(old,base,true,'good'+i);
 delete old.questions[questionKey(base)].recent;for(const event of old.events)delete event.attempt;
 old=normalizeHistory(JSON.parse(JSON.stringify(old)));assert.equal(category(base,old),4);
 old=record(old,base,true,'new');assert.equal(category(base,old),6);
 assert.equal(category(base,normalizeHistory(JSON.parse(JSON.stringify(old)))),6);
});

test('adaptive play through the complete playlist finishes outside a reading or answer phase',()=>{
 const items=JSON.parse(readFileSync(new URL('../quiz-data/junior_math.json',import.meta.url)));
 const index=JSON.parse(readFileSync(new URL('../music-data/index.json',import.meta.url)));
 const entries=['0001','0002'].map(id=>({id,track:index[id],chart:JSON.parse(readFileSync(new URL('../music-data/'+index[id].files.chart,import.meta.url)))}));
 return import('../game.js').then(({makePlaylist})=>{
  const playlist=makePlaylist(entries),random=seeded(312);let history=normalizeHistory(null);
  const pick=createAdaptivePicker(makeQuestionQueue(items,random),()=>history,random);
  const g=new Game(items,playlist.events,0,random,playlist.duration,()=>true,pick);
  for(let t=0;t<=playlist.duration;t+=1/60){
   g.update(t);
   for(const note of [...g.notes].filter(n=>!n.done&&n.target<=t)){
    const before=g.correctCount,q=g.question;g.tap(g.phase==='answer'?q.correct:note.lane,t);
    if(g.correctCount>before)history=record(history,q,true,'play:'+g.questionIndex);
   }
  }
  assert.ok(g.correctCount>0);assert.equal(g.phase,'outro');
 });
});

test('reverse priority follows explicit language and kanji pairs and includes review history',()=>{
 for(const [mode,other] of [['to_english','to_japanese'],['japanese_term','japanese_definition'],['kanji_reading','kanji_component']]){
  const q={...base,mode},reverse={...base,mode:other};let state=normalizeHistory(null);
  state=record(state,reverse,true,'review',0,'review');assert.equal(category(q,state),3);
  state=record(state,reverse,false,'later-review',0,'review');assert.equal(category(q,state),2);
  assert.equal(category({...q,mode:'spelling'},state),1);
 }
});

test('session avoids every shown question and successful reverse while fresh alternatives remain',()=>{
 const qs=Array.from({length:8},(_,i)=>({...base,id:`topic${i}`,sourceId:`topic${i}`}));
 const results=[],pick=createAdaptivePicker(qs.flatMap(q=>[q,inverse(q)]),()=>normalizeHistory(null),()=>0,()=>results);
 const sources=new Set();
 for(let i=0;i<8;i++){
  const [q]=pick();assert.ok(!sources.has(q.sourceId));sources.add(q.sourceId);
  results.push({question:q,correct:true,wrong:0});
 }
 // All fresh alternatives exhausted: another draw must still be possible.
 assert.ok(pick()[0]);
});
test('a failed direction leaves its reverse eligible and relaxes topic spacing before session exclusions',()=>{
 const other={...base,id:'other',sourceId:'other'},results=[];
 const pick=createAdaptivePicker([base,inverse(base),other],()=>normalizeHistory(null),()=>0,()=>results);
 assert.equal(pick()[0].mode,base.mode);
 results.push({question:base,correct:true,wrong:1});
 assert.equal(pick()[0].sourceId,'other');
 results.push({question:other,correct:true,wrong:0});
 const [q]=pick();assert.equal(q.sourceId,base.sourceId);assert.equal(q.mode,inverse(base).mode);
});
test('session keeps multi-hole units intact and an error in any stage permits the reverse',()=>{
 const first={...base,mode:'term_to_explanation',blankIndex:1};
 const second={...first,blankIndex:2,continuation:true};
 const other={...base,id:'other',sourceId:'other'},results=[];
 const pick=createAdaptivePicker([first,second,base,other],()=>normalizeHistory(null),()=>0,()=>results);
 assert.deepEqual(pick().map(q=>q.blankIndex),[1,2]);
 results.push({question:first,correct:true,wrong:0},{question:second,correct:true,wrong:2});
 assert.equal(pick()[0].sourceId,'other');
 assert.equal(pick()[0].mode,base.mode);
});
test('a new play resets session exclusions while historical priorities remain active',()=>{
 const state=record(normalizeHistory(null),base,true,'old-play');
 const other={...base,id:'other',sourceId:'other'};
 const pick=createAdaptivePicker([base,other],()=>state,()=>.99,()=>[]);
 assert.equal(pick()[0].sourceId,base.sourceId);assert.equal(pick()[0].sourceId,'other');
 const next=createAdaptivePicker([base,other],()=>state,()=>.99,()=>[]);
 assert.equal(next()[0].sourceId,base.sourceId);
 assert.equal(category(base,state),5);
});
