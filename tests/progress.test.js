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
test('audited cloze topics are hidden by default and necessary language prompts remain available',()=>{
 const all=['science','japanese','math','social'].flatMap(read).filter(x=>x.explanation_template);
 assert.equal(all.length,131);assert.equal(all.filter(x=>x.cloze_context).length,7);
 for(const item of all){
  assert.equal(typeof item.cloze_context,'string');assert.ok(item.cloze_context_reason.length>0);
  for(const generated of makeBlankQuestions(item)){
   assert.equal(generated.context,item.cloze_context);
   if(!item.cloze_context){assert.equal(generated.task,'説明文を完成させよう');assert.ok(!generated.task.includes(item.term));}
  }
 }
 const english=read('english');assert.ok(makeSpellingQuestions(english.find(x=>x.spelling))[0].context);
 assert.ok(makePhraseQuestions(english.find(x=>x.phrase_blanks))[0].context);
 const unseen={...read('math')[0]};delete unseen.cloze_context;assert.equal(makeBlankQuestions(unseen)[0].context,'');
});
