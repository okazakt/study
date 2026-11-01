import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,RULES,SESSION} from '../game.js';
import {simulateSession} from '../scripts/simulate-session.mjs';
import {practiceTypes,matchesPracticeQuestion} from '../learning.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const item=read('quiz-data/junior_science.json')[0];
const beats=Array.from({length:601},(_,i)=>({time:i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0,type:'beat'}));
const create=()=>new Game([item],beats,0,()=>.5,300,()=>true,null,297,120);
function playWhite(g,start=0,end=300,skipFirst=false){
 let skipped=null,halves=0;
 for(let tick=Math.ceil(start*60);tick<=end*60;tick++){
  const now=tick/60;g.update(now);
  const note=g.notes.find(n=>!n.done && n.target<=now && Math.abs(n.target-now)<.08 && n.id!==skipped);
  if(!note)continue;
  if(skipFirst && skipped===null){skipped=note.id;continue;}
  if(note.half)halves++;
  g.tap(note.lane,now);
 }
 return halves;
}
test('extra half-beat events respect spacing and never become colored answer rows',()=>{
 const g=create();assert.ok(g.events.some(e=>e.half));
 for(let i=1;i<g.events.length;i++)assert.ok(g.events[i].target-g.events[i-1].target>=SESSION.minWhiteInterval-1e-9);
 g.changePhase('answer',10);
 for(let t=10;t<15;t+=1/60){g.update(t);assert.ok(g.notes.every(n=>!n.half));}
 const gap=new Game([item],[...beats.slice(0,10),...beats.slice(30,40)],0,()=>.5,300,()=>true,null,297,120);
 assert.ok(!gap.events.some(e=>e.half && e.target>4.5 && e.target<15));
});
test('white rhythm adds offbeats when behind and reduces density when ahead',()=>{
 const behind=create();behind.changePhase('rhythm',90);assert.ok(behind.whiteTargets.size>RULES.rhythmNotes);assert.ok(behind.events.some(e=>e.half && behind.whiteTargets.has(e.id)));
 const ahead=create();ahead.judgments.PERFECT=20;ahead.changePhase('rhythm',30);assert.ok(ahead.whiteTargets.size<RULES.rhythmNotes);assert.ok(ahead.whiteTargets.size>0);
});
test('outro distributes only the remaining count and uses offbeats to reach exactly 120',()=>{
 const g=create();g.judgments.GOOD=100;g.changePhase('outro',290);
 assert.equal(g.whiteTargets.size,20);assert.ok(g.events.some(e=>e.half && g.whiteTargets.has(e.id)));
 assert.ok(playWhite(g,290)>0);assert.equal(g.successfulTaps,120);assert.equal(g.notes.length,0);
 const capped=create();capped.judgments.PERFECT=120;capped.changePhase('outro',250);assert.equal(capped.whiteTargets.size,0);playWhite(capped,250);assert.equal(capped.successfulTaps,120);
});
test('missed white notes consume the quota without adding replacements or removing in-flight notes',()=>{
 const g=create();g.judgments.PERFECT=100;g.changePhase('outro',280);
 const first=g.events.find(e=>g.whiteTargets.has(e.id));
 g.update(first.target-.05);const other=g.notes.filter(n=>n.id!==first.id).map(n=>n.id);assert.ok(other.length>0);
 const planned=[...g.whiteTargets];g.update(first.target+.17);assert.equal(g.judgments.MISS,1);assert.deepEqual([...g.whiteTargets],planned);for(const id of other)assert.ok(g.notes.some(n=>n.id===id));
 playWhite(g,first.target+.17);assert.equal(g.successfulTaps,119);assert.equal(g.countedTaps,120);
});
test('quiz admission reserves enough final white slots and the remaining answer budget',()=>{
 const g=create();
 const now=Array.from({length:1000},(_,i)=>200+i/10).find(t=>g.earliestCompletion(t)+.25<297 && g.whiteSlots(g.earliestCompletion(t)).length<120-g.unitTaps());
 assert.ok(Number.isFinite(now));g.changePhase('read',now);assert.equal(g.phase,'outro');
 const capped=create();capped.judgments.PERFECT=118;capped.changePhase('read',20);assert.equal(capped.phase,'outro');
});
test('an ongoing multi-hole unit continues even if retries have exceeded the tap goal',()=>{
 const multi=read('quiz-data/junior_science.json').find(q=>q.blanks.length>1);
 const g=new Game([multi],beats,0,()=>.5,300,()=>true,null,297,120);
 g.questionIndex=g.questions.findIndex(q=>q.continuation);assert.ok(g.questionIndex>=0);
 g.judgments.PERFECT=121;g.changePhase('read',220);assert.equal(g.phase,'read');
});
test('all five subjects can finish at exactly 120 successful taps without timing misses',()=>{
 for(const subject of ['japanese','english','math','science','social'])for(let seed=1;seed<=5;seed++)assert.equal(simulateSession(read('quiz-data/junior_'+subject+'.json'),seed).taps,120,subject+seed);
});
test('missed notes count toward 120 while delayed answers may leave no adjustment time',()=>{
 const items=read('quiz-data/junior_math.json');
 const missed=simulateSession(items,1,0,{missFirst:3});assert.equal(missed.taps,117);assert.equal(missed.counted,120);assert.equal(missed.missed,3);
 const slow=simulateSession(items,1,0,{answerDelay:1000});assert.ok(slow.taps<120);assert.equal(slow.answers,0);
});

test('individual Japanese and English practice formats also reach the goal without retries',()=>{
 for(const [subject,file] of [['国語','japanese'],['英語','english']])for(const type of practiceTypes(subject))for(let seed=1;seed<=3;seed++){
  const items=[...read('quiz-data/junior_'+file+'.json'),...read('quiz-data/junior_expansion.json').filter(q=>q.subject===subject),...(subject==='英語'?[...read('quiz-data/junior_english_core.json'),...read('quiz-data/junior_english_extended.json'),...read('quiz-data/junior_english_application.json'),...read('quiz-data/junior_english_supplement.json'),...read('quiz-data/junior_english_vocabulary2.json')]:[])];
  const result=simulateSession(items,seed,0,{acceptQuestion:q=>matchesPracticeQuestion(q,type.id)});
  assert.equal(result.taps,120,subject+':'+type.id+':'+seed);
 }
});

test('retries can exceed the goal rather than cutting off an active answer',()=>{
 const g=create();g.judgments.PERFECT=119;g.changePhase('answer',290);
 const wrong=(g.question.correct+1)%4;
 for(let i=0;i<3;i++){const now=292+i*.5;g.notes=[{target:now,lane:wrong,color:wrong}];g.tap(wrong,now);}
 assert.equal(g.successfulTaps,122);assert.equal(g.wrongCount,1);assert.equal(g.phase,'answer');
 for(let i=0;i<3;i++){const now=294+i*.5;g.notes=[{target:now,lane:g.question.correct,color:g.question.correct}];g.tap(g.question.correct,now);}
 assert.equal(g.correctCount,1);assert.equal(g.successfulTaps,125);assert.equal(g.phase,'feedback');
});

test('a missed four-color row consumes exactly one opportunity and empty presses consume none',()=>{
 const g=create();g.changePhase('answer',10);g.events=[];g.cursor=0;
 g.notes=[0,1,2,3].map(lane=>({target:12,lane,color:lane,rowId:1}));
 g.update(12.17);assert.equal(g.countedTaps,1);assert.equal(g.missedNotes,1);assert.equal(g.judgments.MISS,1);assert.equal(g.colorJudgments,1);
 g.tap(0,13);g.tap(1,13);assert.equal(g.countedTaps,1);assert.equal(g.emptyMisses,2);assert.equal(g.judgments.MISS,3);
});
