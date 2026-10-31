import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHistory,recordAnswer,learningLevel,questionKey,missedQuestions} from '../progress.js';
import {makeBlankQuestions,makeSpellingQuestions,makePhraseQuestions} from '../game.js';
const read=name=>JSON.parse(readFileSync(new URL(`../quiz-data/junior_${name}.json`,import.meta.url)));
const q={id:'sample',sourceId:'sample',mode:'term_to_explanation',blankIndex:1,school_level:'中学',subject:'数学',grade:'中2',reviewLabel:'sample',answer:'正答'};
const scope={school:'中学',subject:'数学',year:2,grade:'中2'};
test('per-question cumulative results retain repeated errors and separate review practice',()=>{
 let state=normalizeHistory(null);
 state=recordAnswer(state,q,{correct:false,chosen:'誤答A'});state=recordAnswer(state,q,{correct:false,chosen:'誤答B',wrongBefore:1});
 state=recordAnswer(state,q,{correct:true,chosen:'正答',wrongBefore:2});
 state=recordAnswer(state,q,{correct:false,kind:'review'});state=recordAnswer(state,q,{correct:true,kind:'review',wrongBefore:1});
 const restored=normalizeHistory(JSON.parse(JSON.stringify(state))),r=restored.questions[questionKey(q)];
 assert.equal(r.correct,1);assert.equal(r.wrong,2);assert.equal(r.first,0);assert.equal(r.reviewWrong,1);assert.equal(r.reviewCorrect,1);
 assert.equal(restored.events[2].wrongBefore,2);assert.equal(restored.events[0].chosen,'誤答A');
 assert.equal(learningLevel(restored,scope).count,3);
});
test('level needs 30 confirmations and 10 distinct question keys and updates on errors and correct answers',()=>{
 let state=normalizeHistory(null);
 for(let i=0;i<29;i++)state=recordAnswer(state,{...q,sourceId:`q${i%10}`},{correct:true});
 assert.equal(learningLevel(state,scope).value,null);
 state=recordAnswer(state,q,{correct:true});const before=learningLevel(state,scope).value;assert.ok(before>0);
 state=recordAnswer(state,q,{correct:false});const lower=learningLevel(state,scope).value;assert.ok(lower<before);
 state=recordAnswer(state,q,{correct:true,wrongBefore:1});assert.ok(learningLevel(state,scope).value>lower);
 let repeat=normalizeHistory(null);for(let i=0;i<40;i++)repeat=recordAnswer(repeat,q,{correct:true});assert.equal(learningLevel(repeat,scope).value,null);
});
test('level separates schools subjects and grades; entrance scope combines grades and excludes review',()=>{
 let state=normalizeHistory(null);
 for(const extra of [{},{grade:'中3'},{subject:'理科'},{school_level:'高校'}])state=recordAnswer(state,{...q,...extra},{correct:true});
 state=recordAnswer(state,q,{correct:true,kind:'review'});
 assert.equal(learningLevel(state,scope).count,1);assert.equal(learningLevel(state,{...scope,year:'exam'}).count,2);
 const many={...state,events:Array.from({length:120},(_,i)=>({...state.events[0],key:String(i),correct:i>=20}))};
 assert.equal(learningLevel(many,scope).count,100);assert.ok(learningLevel(many,scope).value>95);
});
test('review contains only actually missed stages including unresolved errors and removes repeated instances',()=>{
 const second={...q,blankIndex:2},inverse={...q,mode:'explanation_to_term',blankIndex:0};
 const selected=missedQuestions([{question:q,wrong:2,correct:true},{question:second,wrong:0,correct:true},{question:inverse,wrong:1,correct:false},{question:q,wrong:1,correct:false}]);
 assert.deepEqual(selected,[q,inverse]);assert.notEqual(questionKey(q),questionKey(second));assert.notEqual(questionKey(q),questionKey(inverse));
});
test('history pruning retains cumulative totals, invalid histories safely reset',()=>{
 let state=normalizeHistory(null);state.events=Array.from({length:10000},()=>({key:'old',correct:true,kind:'play',subject:'数学',grade:'中2'}));
 state.questions[questionKey(q)]={correct:10000,wrong:50,first:9990,reviewCorrect:0,reviewWrong:0};
 state=recordAnswer(state,q,{correct:true});assert.equal(state.events.length,10000);assert.equal(state.questions[questionKey(q)].correct,10001);
 assert.equal(normalizeHistory({version:99}).events.length,0);assert.equal(normalizeHistory({version:1,questions:{bad:{correct:-1}},events:[null,{}]}).questions.bad.correct,0);
});
test('cloze themes are visible by default while explicit answer-bearing parts are removed',()=>{
 const all=['science','japanese','math','social'].flatMap(read).filter(x=>x.explanation_template);
 assert.equal(all.length,131);assert.equal(all.filter(x=>x.cloze_context).length,131);
 for(const item of all){
  assert.equal(typeof item.cloze_context,'string');assert.ok(item.cloze_context_reason.length>0);
  for(const generated of makeBlankQuestions(item)){
   assert.equal(generated.context,item.cloze_context);
   if(!item.cloze_context){assert.equal(generated.task,'説明文を完成させよう');assert.ok(!generated.task.includes(item.term));}
  }
 }
 const english=read('english');assert.ok(makeSpellingQuestions(english.find(x=>x.spelling))[0].context);
 assert.ok(makePhraseQuestions(english.find(x=>x.phrase_blanks))[0].context);
 const unseen={...read('math')[0]};delete unseen.cloze_context;assert.equal(makeBlankQuestions(unseen)[0].context,unseen.term);
});

test('personal bests persist independent values, increase strictly and ignore zeros and invalid values',async()=>{
 const {normalizeBests,updateBests}=await import('../progress.js');
 const first=updateBests(null,{totalScore:100,rhythmCombo:10,quizCombo:3});
 assert.deepEqual(first.updated,{totalScore:true,rhythmCombo:true,quizCombo:true});
 const restored=normalizeBests(JSON.parse(JSON.stringify(first.best)));
 const next=updateBests(restored,{totalScore:100,rhythmCombo:12,quizCombo:2});
 assert.deepEqual(next.updated,{totalScore:false,rhythmCombo:true,quizCombo:false});
 assert.deepEqual(next.best,{totalScore:100,rhythmCombo:12,quizCombo:3});
 assert.deepEqual(restored,first.best);
 assert.deepEqual(updateBests(null,{totalScore:0,rhythmCombo:0,quizCombo:0}).updated,{totalScore:false,rhythmCombo:false,quizCombo:false});
 assert.deepEqual(normalizeBests({totalScore:-1,rhythmCombo:Infinity,quizCombo:'9'}),{totalScore:0,rhythmCombo:0,quizCombo:0});
});

test('human rights topic is restored and answer-bearing theme fragments alone are generalized',()=>{
 const rights=read('social').find(q=>q.term==='基本的人権');assert.equal(makeBlankQuestions(rights)[0].context,'基本的人権');
 const math=read('math');for(const item of math.filter(q=>q.unit==='三角形の合同'))assert.equal(makeBlankQuestions(item)[0].context,'三角形の合同条件');
 const past=read('japanese').find(q=>q.id==='jr_jp3_031');assert.equal(makeBlankQuestions(past)[0].context,'古文の助動詞「き」');assert.ok(!makeBlankQuestions(past)[0].context.includes('過去'));
 const normal=read('math').find(q=>q.term==='三角形の内角の和');assert.equal(makeBlankQuestions(normal)[0].context,normal.term);
});


test('answer occurrences count once through retries and retain three rich results and the last response time',()=>{
 let state=normalizeHistory(null);
 for(const [correct,chosen,time,wrongBefore] of [[false,'A',100,0],[false,'B',200,1],[true,'正答',300,2]])state=recordAnswer(state,q,{correct,chosen,time,wrongBefore,attempt:'one'});
 let row=state.questions[questionKey(q)];assert.equal(row.answerCount,1);assert.equal(row.lastAt,300);
 assert.deepEqual(row.recent,[{attempt:'one',correct:false,solved:true,wrongCount:2,chosen:'正答',time:300,kind:'play'}]);
 assert.equal(row.correct,1);assert.equal(row.wrong,2);assert.equal(row.first,0);
 const before=structuredClone(state);
 state=recordAnswer(state,q,{correct:true,chosen:'正答',time:400,attempt:'two'});
 state=recordAnswer(state,q,{correct:false,chosen:'C',time:500,attempt:'three'});
 state=recordAnswer(state,q,{correct:true,chosen:'正答',time:600,attempt:'four'});
 row=normalizeHistory(JSON.parse(JSON.stringify(state))).questions[questionKey(q)];
 assert.equal(row.answerCount,4);assert.equal(row.lastAt,600);assert.equal(row.answerCountEstimated,false);
 assert.deepEqual(row.recent.map(r=>[r.attempt,r.correct,r.solved]),[['two',true,true],['three',false,false],['four',true,true]]);
 assert.equal(before.questions[questionKey(q)].answerCount,1);
});
test('wrong-only interrupted occurrences count once, and review is another occurrence with separate totals',()=>{
 let state=normalizeHistory(null);
 state=recordAnswer(state,q,{correct:false,chosen:'A',time:10,attempt:'aborted'});
 state=recordAnswer(state,q,{correct:false,chosen:'B',time:20,wrongBefore:1,attempt:'aborted'});
 assert.equal(state.questions[questionKey(q)].answerCount,1);
 state=recordAnswer(state,q,{correct:true,chosen:'正答',time:30,kind:'review',attempt:'review'});
 const row=state.questions[questionKey(q)];assert.equal(row.answerCount,2);assert.equal(row.correct,0);assert.equal(row.reviewCorrect,1);
 assert.deepEqual(row.recent.map(r=>[r.solved,r.wrongCount,r.kind]),[[false,2,'play'],[true,0,'review']]);
});
test('occurrence count and recent metadata survive detailed event pruning and continue incrementing',()=>{
 let state=normalizeHistory(null);state=recordAnswer(state,q,{correct:true,time:5,attempt:'old'});
 state.questions[questionKey(q)].answerCount=12000;state.questions[questionKey(q)].correct=12000;
 state.events=Array.from({length:10000},(_,i)=>({...state.events[0],key:'unrelated',attempt:'other'+i}));
 state=recordAnswer(state,q,{correct:false,time:6,attempt:'next'});
 assert.equal(state.events.length,10000);
 const restored=normalizeHistory(JSON.parse(JSON.stringify(state))).questions[questionKey(q)];
 assert.equal(restored.answerCount,12001);assert.equal(restored.answerCountEstimated,false);
 assert.deepEqual(restored.recent.map(r=>r.attempt),['old','next']);assert.equal(restored.lastAt,6);
});
test('legacy histories recover exact occurrence counts including unfinished retries and rich recent results',()=>{
 let state=normalizeHistory(null);
 for(const options of [
  {correct:false,time:1,attempt:'retry'}, {correct:true,time:2,attempt:'retry',wrongBefore:1},
  {correct:true,time:3,attempt:'clean'}, {correct:false,time:4,attempt:'unfinished'}
 ])state=recordAnswer(state,q,options);
 const raw=JSON.parse(JSON.stringify(state)),row=raw.questions[questionKey(q)];
 delete row.answerCount;delete row.answerCountEstimated;delete row.lastAt;
 row.recent=row.recent.map(r=>({attempt:r.attempt,correct:r.correct}));
 const restored=normalizeHistory(raw).questions[questionKey(q)];
 assert.equal(restored.answerCount,3);assert.equal(restored.answerCountEstimated,false);assert.equal(restored.lastAt,4);
 assert.deepEqual(restored.recent.map(r=>[r.correct,r.solved,r.wrongCount,r.time]),[[false,true,1,2],[true,true,0,3],[false,false,1,4]]);
 delete row.recent;for(const e of raw.events)delete e.attempt;
 const older=normalizeHistory(raw).questions[questionKey(q)];assert.equal(older.answerCount,3);assert.equal(older.answerCountEstimated,false);
 assert.deepEqual(older.recent.map(r=>r.correct),[false,true,false]);
});
test('incomplete legacy details yield an explicit lower bound without invented old outcome or dates',()=>{
 const state=normalizeHistory({version:1,questions:{[questionKey(q)]:{correct:20,wrong:5,first:18,reviewCorrect:0,reviewWrong:0,recent:[{attempt:'unknown',correct:false}]}},events:[]});
 const row=state.questions[questionKey(q)];assert.equal(row.answerCount,20);assert.equal(row.answerCountEstimated,true);
 assert.equal(row.lastAt,0);assert.equal(row.recent[0].solved,null);assert.equal(row.recent[0].chosen,null);assert.equal(row.recent[0].time,null);
 const next=recordAnswer(state,q,{correct:true,time:50,attempt:'new'});assert.equal(next.questions[questionKey(q)].answerCount,21);assert.equal(next.questions[questionKey(q)].answerCountEstimated,true);
});

test('legacy wrongBefore resets distinguish separate aborted attempts without stable identifiers',()=>{
 let state=normalizeHistory(null);
 for(let i=0;i<2;i++)state=recordAnswer(state,q,{correct:false,time:i+1,attempt:'aborted'+i});
 const raw=JSON.parse(JSON.stringify(state)),row=raw.questions[questionKey(q)];delete row.answerCount;delete row.answerCountEstimated;delete row.recent;
 for(const e of raw.events)delete e.attempt;
 const restored=normalizeHistory(raw).questions[questionKey(q)];assert.equal(restored.answerCount,2);assert.equal(restored.answerCountEstimated,false);
 for(const e of raw.events)delete e.wrongBefore;
 assert.equal(normalizeHistory(raw).questions[questionKey(q)].answerCountEstimated,true);
});

test('pruned wrong-only legacy totals still prove at least one occurrence per play or review kind',()=>{
 const state=normalizeHistory({version:1,questions:{[questionKey(q)]:{correct:0,wrong:10,reviewCorrect:0,reviewWrong:2}},events:[]});
 const row=state.questions[questionKey(q)];assert.equal(row.answerCount,2);assert.equal(row.answerCountEstimated,true);assert.deepEqual(row.recent,[]);
});

test('older synthetic recent IDs align with recoverable legacy event metadata',()=>{
 let state=normalizeHistory(null);state=recordAnswer(state,q,{correct:false,chosen:'A',time:1,attempt:'retry'});state=recordAnswer(state,q,{correct:true,chosen:'正答',time:2,wrongBefore:1,attempt:'retry'});
 state=recordAnswer(state,q,{correct:true,chosen:'正答',time:3,attempt:'clean'});
 const raw=JSON.parse(JSON.stringify(state)),row=raw.questions[questionKey(q)];delete row.answerCount;delete row.answerCountEstimated;
 row.recent=row.recent.map((r,i)=>({attempt:'legacy:old-id:'+i,correct:r.correct}));for(const e of raw.events)delete e.attempt;
 const restored=normalizeHistory(raw).questions[questionKey(q)];assert.equal(restored.answerCount,2);
 assert.deepEqual(restored.recent.map(r=>[r.solved,r.wrongCount,r.chosen,r.time]),[[true,1,'正答',2],[true,0,'正答',3]]);
});
