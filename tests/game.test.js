import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, makeQuestion, RULES, easyEvents, revealPlan, makeBlankQuestions, makeQuestionQueue, answerProgress, makeEnglishQuestion, makeSpellingQuestions, makePlaylist, makePhraseQuestions } from '../game.js';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const questions = read('../quiz-data/junior_science.json');
const track = read('../music-data/index.json')['0001'];
const chart = read(`../music-data/${track.files.chart}`);
const fixture = () => new Game(questions.slice(0, 2), [], 0, () => .5);
function hit(game, color, time, delta = 0) {
  game.notes.push({ target: time, color, lane: 2, done: false });
  return game.tap(2, time + delta);
}
test('all real questions produce four distinct choices and fully resolved explanations', () => {
  assert.equal(questions.length, 89);
  assert.equal(new Set(questions.map(q => q.id)).size, 89);
  for (const q of questions) {
    const result = makeQuestion(q);
    assert.equal(result.choices.length, 4); assert.equal(new Set(result.choices).size, 4);
    assert.equal(result.choices[result.correct], q.term); assert.ok(!result.prompt.includes('{{'));
    for (const blank of q.blanks) assert.ok(result.prompt.includes(blank.answer));
  }
});
test('chart events use audio seconds and only the two extra offsets', () => {
  assert.equal(chart.events.length, 605);
  assert.ok(chart.events.every((e, i, all) => Number.isFinite(e.time) && e.time >= 0 && (!i || e.time >= all[i - 1].time)));
  assert.ok(chart.events.at(-1).time < track.durationSeconds);
  const g = new Game(questions, chart.events, .125);
  assert.equal(g.events[0].target, easyEvents(chart.events)[0].time + .125);
  for (const path of Object.values(track.files)) assert.ok(readFileSync(new URL(`../music-data/${path}`, import.meta.url)).length);
});
test('white notes require their lane; perfect, good, misses and empty taps affect rhythm only', () => {
  const g = fixture(); g.notes = [{target:2, color:null, lane:0}];
  assert.equal(g.tap(3, 2),null); assert.equal(g.rhythmScore,0);
  g.tap(0, 2); assert.equal(g.rhythmScore, 11); assert.equal(g.combo, 1);
  hit(g, null, 3, .12); assert.equal(g.rhythmScore, 18); assert.equal(g.combo, 2);
  g.notes.push({target:4,color:null,lane:0}); g.update(4.17); assert.equal(g.combo, 0);
  hit(g, null, 5); g.tap(0, 5.5); assert.equal(g.combo, 0); assert.equal(g.quizScore, 0);
});
test('wrong lane and out-of-window taps do not consume a colored note', () => {
  const g = fixture(); g.changePhase('answer', 0); g.notes.push({target:2,color:1,lane:2});
  assert.equal(g.tap(1, 2), null); assert.equal(g.notes[0].done, undefined);
  assert.equal(g.tap(2, 1.8), null); assert.equal(g.rhythmScore, 0);
  assert.ok(g.tap(2, 2));
});
test('three correct color hits confirm one answer, with separate first-answer combo', () => {
  const g = fixture(); g.changePhase('answer', 0); const c = g.question.correct;
  hit(g,c,2); hit(g,c,3); assert.equal(g.correctCount,0); hit(g,c,4);
  assert.equal(g.phase,'feedback'); assert.equal(g.correctCount,1); assert.equal(g.quizScore,60);
  assert.equal(g.quizCombo,1); assert.equal(g.combo,3);
  g.update(4 + RULES.feedbackSeconds); assert.equal(g.phase,'read'); assert.equal(g.questionIndex,1);
  const answerStart = 4 + RULES.feedbackSeconds + g.reveal.duration;
  g.update(answerStart); assert.equal(g.phase,'answer');
  const c2 = g.question.correct;
  hit(g,c2,answerStart+2); hit(g,c2,answerStart+3); hit(g,c2,answerStart+4);
  assert.equal(g.quizScore,130); assert.equal(g.quizCombo,2); assert.equal(g.maxQuizCombo,2);
});
test('wrong answers keep the same question and colors, reset progress, and break both combos', () => {
  const g = fixture(); g.changePhase('answer',0); g.quizCombo = 2;
  const q = g.question, wrong = (q.correct + 1) % 4;
  hit(g,wrong,2); hit(g,wrong,3); hit(g,wrong,4);
  assert.equal(g.phase,'answer'); assert.equal(g.question,q); assert.equal(g.questionIndex,0);
  assert.equal(g.firstTry,false); assert.equal(g.quizCombo,0); assert.equal(g.combo,0);
  assert.deepEqual(g.counts,[0,0,0,0]);
  hit(g,q.correct,5); hit(g,q.correct,6); hit(g,q.correct,7);
  assert.equal(g.correctCount,1); assert.equal(g.firstCount,0); assert.equal(g.quizScore,50); assert.equal(g.phase,'feedback');
});
test('unchosen sibling colors are not misses and counts remain independent', () => {
  const g=new Game(questions,chart.events); g.changePhase('answer',8); const c=g.question.correct;
  const events=g.events.filter(e=>e.target>=8+RULES.travelSeconds).slice(0,4);
  for (let i=0;i<events.length;i++) {
    const e=events[i]; g.update(e.target-1); g.tap(i===1?(c+1)%4:c,e.target);
    g.update(e.target+.2); assert.notEqual(g.lastJudgment,'MISS');
  }
  assert.equal(g.phase,'feedback'); assert.equal(g.firstCount,1);
});
test('a transition waits for the final note and its judgment instead of discarding it', () => {
  const g = fixture(); g.combo=8; g.notes.push({target:8.1,color:null,lane:2});
  g.update(8); assert.equal(g.phase,'intro'); assert.equal(g.notes.length,1);
  g.tap(2,8.1); assert.equal(g.lastJudgment,'PERFECT'); assert.equal(g.combo,9);
  g.update(8.8); assert.equal(g.phase,'intro');
  g.update(9.01); assert.equal(g.phase,'read'); assert.equal(g.notes.length,0);
  g.finish(); hit(g,null,10); assert.equal(g.rhythmScore,19); assert.equal(g.phase,'ended');
});
test('main-beat chart keeps every beat without subdivisions or duplicate times', () => {
  const selected = easyEvents(chart.events);
  assert.equal(selected.length,450);
  assert.equal(new Set(selected.map(e => `${e.bar}:${e.beatInBar}`)).size,selected.length);
  assert.ok(selected.every(e => e.beatInBar >= 1 && e.beatInBar <= 4 && e.beatPosition === 0 && chart.events.includes(e)));
  const g = new Game(questions,chart.events);
  assert.deepEqual(g.events.map(e=>e.target),selected.map(e=>e.time));
  assert.equal(easyEvents([selected[0],selected[0]]).length,1);
});
test('text and each choice finish in order before lifting, then colored notes may spawn', () => {
  for (const q of questions) {
    const plan = revealPlan(makeQuestion(q));
    let previousEnd = plan.prompt.end;
    for (const choice of plan.choices) { assert.ok(choice.start > previousEnd); previousEnd = choice.end; }
    assert.ok(plan.liftStart > previousEnd); assert.equal(plan.duration,plan.liftStart+RULES.liftSeconds);
  }
  const g = new Game(questions,chart.events); g.changePhase('read',20);
  const end = 20 + g.reveal.duration;
  g.update(end-.01); assert.equal(g.phase,'read'); assert.deepEqual(g.notes,[]);
  const unchanged = JSON.stringify(g.notes); g.update(end-.01); assert.equal(JSON.stringify(g.notes),unchanged);
  g.update(end); assert.equal(g.phase,'answer'); assert.deepEqual(g.notes,[]);
  g.update(end+2); assert.ok(g.notes.every(n=>n.color!==null));
});

test('reading suppresses notes and ignores taps without losing combo or progress', () => {
  const g = new Game(questions,chart.events); g.combo=9; g.changePhase('read',8);
  for (let now=8;now<8+g.reveal.duration;now+=.1) {
    g.update(now); assert.deepEqual(g.notes,[]);
    g.tap(0,now); assert.equal(g.combo,9); assert.equal(g.rhythmScore,0);
  }
  assert.equal(g.lastJudgment,''); assert.deepEqual(g.counts,[0,0,0,0]);
});
test('answer rows offer four simultaneous colors, ordered like choices, one selection per row', () => {
  const g = new Game(questions,chart.events); g.changePhase('answer',8);
  assert.equal(g.laneCount,4);
  const event=g.events.find(e=>e.target>=8+RULES.travelSeconds);
  g.update(event.target-1);
  const row=g.notes.filter(n=>n.rowId===event.id);
  assert.equal(row.length,4); assert.deepEqual(row.map(n=>n.color),[0,1,2,3]);
  assert.deepEqual(row.map(n=>n.lane),[0,1,2,3]); assert.ok(row.every(n=>n.target===event.target));
  assert.ok(g.tap(1,event.target)); assert.equal(g.counts[1],1); assert.equal(g.rhythmScore,2);
  assert.ok(row.every(n=>n.done));
  g.tap(2,event.target); assert.equal(g.counts[2],0); assert.equal(g.rhythmScore,2);
  const next=g.events.find(e=>e.target>event.target);
  g.update(next.target-1); assert.equal(g.notes.filter(n=>!n.done&&n.rowId===next.id).length,4);
  g.tap(1,next.target); assert.equal(g.counts[1],2);
});
test('each color can confirm an answer on three successive rows', () => {
  for (let color=0;color<4;color++) {
    const g=new Game(questions,chart.events); g.changePhase('answer',8); g.question.correct=color;
    const events=g.events.filter(e=>e.target>=8+RULES.travelSeconds).slice(0,3);
    for (const e of events) { g.update(e.target-1); g.tap(color,e.target); }
    assert.equal(g.correctCount,1); assert.equal(g.quizScore,60); assert.equal(g.phase,'feedback');
  }
});

test('all phases keep four lanes and white notes use shuffled single lanes', () => {
  const g = new Game(questions,chart.events,0,()=>.5);
  for (const phase of ['intro','read','answer','feedback']) { g.changePhase(phase,0); assert.equal(g.laneCount,4); }
  for (let i=0;i<g.events.length;i+=4) {
    const lanes=g.events.slice(i,i+4).map(e=>e.lane);
    assert.equal(new Set(lanes).size,lanes.length);
    assert.ok(lanes.every(l=>l>=0&&l<4));
  }
  g.changePhase('intro',0);
  const event=g.events[0]; g.update(event.target-1);
  assert.equal(g.notes.filter(n=>n.id===event.id).length,1); assert.equal(g.notes.find(n=>n.id===event.id).color,null);
  assert.equal(g.notes.find(n=>n.id===event.id).lane,event.lane);
  assert.equal(g.tap((event.lane+1)%4,event.target),null);
  assert.equal(g.rhythmScore,0); assert.ok(g.tap(event.lane,event.target)); assert.equal(g.rhythmScore,11);
});

test('missing an entire answer row reports one MISS, but a successful row reports none', () => {
  const g=new Game(questions,chart.events); g.changePhase('answer',8); g.combo=5;
  const event=g.events.find(e=>e.target>=8+RULES.travelSeconds); g.update(event.target-1);
  let misses=0; const judge=g.judge.bind(g); g.judge=(label,time)=>{ if(label==='MISS')misses++; judge(label,time); };
  g.update(event.target+RULES.goodWindow+.01);
  assert.equal(misses,1); assert.equal(g.lastJudgment,'MISS'); assert.equal(g.combo,0); assert.deepEqual(g.counts,[0,0,0,0]);
  g.tap(0,event.target+.24); assert.equal(g.lastJudgment,'MISS');
});
test('correct and wrong answers keep explicit results separately from rhythm judgments', () => {
  const g=fixture(); g.changePhase('answer',0); const correct=g.question.correct;
  for (let t=2;t<=4;t++) hit(g,(correct+1)%4,t);
  assert.equal(g.quizResult.correct,false); assert.equal(g.lastJudgment,'PERFECT'); assert.equal(g.phase,'answer');
  for (let t=5;t<=7;t++) hit(g,correct,t);
  assert.equal(g.quizResult.correct,true); assert.equal(g.lastJudgment,'PERFECT'); assert.equal(g.phase,'feedback');
});
test('correct confirmation clears pending notes without misses or extra input during feedback', () => {
  const g=fixture(); g.changePhase('answer',0); const c=g.question.correct;
  hit(g,c,2); hit(g,c,3); g.notes.push({target:5,color:c,lane:1,rowId:99}); hit(g,c,4);
  assert.equal(g.phase,'feedback'); assert.deepEqual(g.notes,[]);
  assert.equal(g.lastJudgment,'PERFECT');const score=g.rhythmScore,combo=g.combo;
  g.tap(1,4.5);g.update(5.2);assert.equal(g.lastJudgment,'PERFECT');
  assert.equal(g.rhythmScore,score);assert.equal(g.combo,combo);assert.equal(g.correctCount,1);
  g.update(6.5); assert.equal(g.phase,'read');
  const real=new Game(questions,chart.events); real.changePhase('feedback',20);
  for(let t=20;t<22.5;t+=.05){ real.update(t); assert.deepEqual(real.notes,[]); }
});
test('intro scheduling leaves time to show final judgments; overdue events are not silently lost', () => {
  const g=new Game(questions,chart.events); g.update(6.5);
  assert.equal(g.lastJudgment,'MISS'); assert.equal(g.judgmentTime,6.5);
  for(let t=6.5;t<=8;t+=.02) {
    g.update(t); assert.ok(g.notes.every(n=>n.target+RULES.goodWindow+RULES.judgmentSeconds<=RULES.introSeconds));
  }
  g.update(8); assert.equal(g.phase,'read'); assert.deepEqual(g.notes,[]);
});

test('all 97 blanks generate distinct four-choice questions with exactly one active target', () => {
  let count=0;
  for (const item of questions) {
    const blanks=makeBlankQuestions(item); count+=blanks.length;
    assert.equal(blanks.length,item.blanks.length);
    for (const q of blanks) {
      const blank=item.blanks.find(b=>b.index===q.blankIndex);
      assert.equal(q.choices.length,4); assert.equal(new Set(q.choices).size,4);
      assert.equal(q.choices[q.correct],blank.answer); assert.equal(q.answer,blank.answer);
      assert.equal(q.context,item.cloze_context || ''); assert.ok(q.targetLabel.includes(`？`)); assert.ok(q.targetLabel.includes(`${q.blankPosition} / ${q.blankTotal}`));
      assert.equal(q.segments.filter(s=>s.state==='active').length,1);
      assert.ok(!q.prompt.includes('{{'));
      for (const segment of q.segments.filter(s=>s.index)) {
        const target=item.blanks.find(b=>b.index===segment.index);
        if(segment.index<q.blankIndex){assert.equal(segment.state,'solved');assert.equal(segment.text,target.answer);}
        else {assert.equal(segment.text,'？');assert.notEqual(segment.text,target.answer);}
      }
    }
  }
  assert.equal(count,97);
});
test('science queue groups explanation blanks and separates reverse directions by other sources', () => {
  const queue=makeQuestionQueue(questions,()=>.5);assert.equal(queue.length,186);
  assert.equal(queue.filter(q=>q.mode==='explanation_to_term').length,89);
  assert.equal(queue.filter(q=>q.mode==='term_to_explanation').length,97);
  for(let i=1;i<queue.length;i++)if(!queue[i].continuation)assert.notEqual(queue[i].sourceId,queue[i-1].sourceId);
  const multiple=questions.find(q=>q.blanks.length>1);
  const positions=queue.map((q,i)=>q.sourceId===multiple.id?i:-1).filter(i=>i>=0);
  assert.equal(positions[1],positions[0]+1);assert.ok(positions[2]-positions[1]>3);
  const reversed=makeBlankQuestions({...multiple,blanks:[...multiple.blanks].reverse()});assert.deepEqual(reversed.map(q=>q.blankIndex),[1,2]);
});
test('wrong answers stay on the target blank; correct advances to the next blank before a new question', () => {
  const item=questions.find(q=>q.blanks.length>1), g=new Game([item],[],0,()=>.5);
  g.changePhase('answer',0); assert.equal(g.question.blankIndex,1);
  for(let t=2;t<=4;t++)hit(g,(g.question.correct+1)%4,t);
  assert.equal(g.questionIndex,0);assert.equal(g.question.blankIndex,1);assert.equal(g.phase,'answer');
  for(let t=5;t<=7;t++)hit(g,g.question.correct,t);
  g.update(9.5); assert.equal(g.phase,'read');assert.equal(g.question.blankIndex,2);
  assert.deepEqual(g.counts,[0,0,0,0]);assert.ok(g.question.prompt.includes(item.blanks[0].answer));
  assert.ok(g.question.targetLabel.includes('2 / 2'));
  const time=9.5+g.reveal.duration;g.update(time);
  for(let t=time+2;t<=time+4;t++)hit(g,g.question.correct,t);
  g.update(time+6.5);assert.equal(g.question.mode,'explanation_to_term');assert.equal(g.correctCount,2);assert.equal(g.quizScore,110);
});

test('the next explanation blank keeps the prompt visible and schedules new choices', () => {
  for (const item of questions) {
    const blanks=makeBlankQuestions(item);
    for (const q of blanks) {
      assert.equal(q.context,item.cloze_context || ''); assert.ok(!q.prompt.includes('穴')); assert.ok(!q.targetLabel.includes('穴'));
      assert.ok(!q.reviewLabel.includes('→')); const plan=revealPlan(q);
      if(q.blankPosition===1){assert.equal(plan.continuation,false);if(q.context){assert.ok(plan.context.end>plan.context.start);assert.ok(plan.prompt.start>plan.context.end);}else assert.equal(plan.context.end,0);assert.ok(plan.choices[0].start>plan.prompt.end);}
      else {assert.equal(plan.continuation,true);assert.equal(plan.duration,plan.revealEnd+RULES.readHoldSeconds);assert.ok(plan.choices[0].start>0);assert.equal(plan.prompt.end,0);}
    }
    assert.equal(makeQuestion(item).context,''); assert.equal(makeQuestion(item).reviewLabel,item.term);
  }
});

test('normal play fits eight white notes between groups and waits for final judgment', () => {
  const g=new Game([questions[0]],chart.events,0,()=>.5);g.changePhase('feedback',20);
  g.update(22.5);assert.equal(g.phase,'rhythm');assert.equal(g.questionIndex,0);
  const targets=g.events.filter(e=>g.rhythmTargets.has(e.id));assert.equal(targets.length,8);
  const quizScore=g.quizScore;
  for(const e of targets){g.update(e.target-1);const note=g.notes.find(n=>n.id===e.id);assert.ok(note);assert.equal(note.color,null);g.tap(e.lane,e.target);}
  assert.equal(g.quizScore,quizScore);assert.equal(g.rhythmScore,116);assert.equal(g.phase,'rhythm');
  g.update(targets.at(-1).target+.5);assert.equal(g.phase,'rhythm');
  g.update(g.rhythmEnd+.01);assert.equal(g.phase,'read');assert.equal(g.questionIndex,1);assert.deepEqual(g.notes,[]);
});
test('multiple explanation blanks continue directly before the normal-play break', () => {
  const item=questions.find(q=>q.blanks.length>1);const g=new Game([item],chart.events,0,()=>.5);
  g.changePhase('feedback',20);g.update(22.5);assert.equal(g.phase,'read');assert.equal(g.question.blankPosition,2);assert.equal(g.reveal.continuation,true);
  g.changePhase('feedback',30);g.update(32.5);assert.equal(g.phase,'rhythm');
});
test('instructions match the requested action and all choices use reviewed three-dummy sets', () => {
  for(const item of questions){
    assert.equal(item.term_dummies.length,3);
    assert.equal(makeQuestion(item).task,'次の説明にあてはまる用語を選ぼう');
    for(const q of makeBlankQuestions(item)){
      assert.equal(item.blanks.find(b=>b.index===q.blankIndex).dummies.length,3);
      assert.equal(q.task,item.cloze_context ? `「${item.cloze_context}」の説明を完成させよう` : '説明文を完成させよう');
    }
  }
  const law=questions.find(q=>q.term==='分離の法則');
  assert.deepEqual(new Set(law.term_dummies),new Set(['独立の法則','顕性の法則','伴性遺伝']));
  const gene=questions.find(q=>q.term==='DNA');assert.ok(gene.term_dummies.includes('RNA'));assert.ok(!gene.term_dummies.includes('デンプン'));
});

test('answer progress is a bounded ratio and supports a future ten-tap question', () => {
  assert.equal(answerProgress(0,3),0);assert.equal(answerProgress(1,3),1/3);assert.equal(answerProgress(3,3),1);
  assert.equal(answerProgress(1,10),.1);assert.equal(answerProgress(5,10),.5);assert.equal(answerProgress(9,10),.9);
  assert.equal(answerProgress(12,10),1);assert.equal(answerProgress(-2,10),0);assert.equal(answerProgress(1,0),0);
  const g=fixture();g.question.tapsToAnswer=10;g.changePhase('answer',0);const color=g.question.correct;
  for(let n=1;n<=9;n++)hit(g,color,n+1);
  assert.equal(g.phase,'answer');assert.equal(g.correctCount,0);assert.equal(answerProgress(g.counts[color],g.requiredTaps),.9);
  hit(g,color,11);assert.equal(g.phase,'feedback');assert.equal(g.correctCount,1);assert.equal(answerProgress(g.counts[color],g.requiredTaps),1);
});
test('dense answer rows clear immediately on correct confirmation and retain the winning judgment', () => {
  const g=new Game([questions[0]],chart.events,0,()=>.5);g.changePhase('answer',8);
  const rows=g.events.filter(e=>e.target>=8+RULES.travelSeconds).slice(0,3);
  assert.ok(rows.every((e,i)=>i===0||e.target-rows[i-1].target<.55));
  for(const row of rows){g.update(Math.max(g.time,row.target-1));g.tap(g.question.correct,row.target);}
  assert.equal(g.phase,'feedback');assert.deepEqual(g.notes,[]);assert.equal(g.lastJudgment,'PERFECT');
  const time=rows.at(-1).target,combo=g.combo;
  for(let t=time+.1;t<time+RULES.feedbackSeconds;t+=.1){g.update(t);assert.deepEqual(g.notes,[]);assert.equal(g.lastJudgment,'PERFECT');assert.equal(g.combo,combo);}
  g.update(time+RULES.feedbackSeconds+.01);assert.equal(g.phase,'rhythm');
});

const english = read('../quiz-data/junior_english.json');
test('English data generates both translation directions and complete, unique spelling stages', () => {
  assert.equal(english.length,32);
  assert.equal(english.filter(q=>q.field==='熟語').length,8);
  assert.equal(new Set([...questions,...english].map(q=>q.id)).size,121);
  for(const item of english){
    for(const direction of ['to_japanese','to_english']){
      const q=makeEnglishQuestion(item,direction);
      assert.equal(q.answer,direction==='to_japanese'?item.japanese:item.english);
      assert.equal(q.prompt,direction==='to_japanese'?item.english:item.japanese);
      assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
      assert.equal(q.choices[q.correct],q.answer);
    }
    if(item.phrase_blanks) continue;
    const stages=makeSpellingQuestions(item);
    assert.ok(stages.length>=2);
    const complete=item.spelling_template.replace(/\{\{(\d+)\}\}/g,(_,n)=>item.spelling.find(b=>b.index===Number(n)).answer);
    assert.equal(complete,item.english);
    for(const [i,q] of stages.entries()){
      assert.equal(q.blankPosition,i+1);assert.equal(new Set(q.choices).size,4);
      assert.equal(q.choices.length,4);assert.equal(q.choices[q.correct],item.spelling[i].answer);
      assert.equal(q.segments.filter(s=>s.state==='active').length,1);
      for(const segment of q.segments.filter(s=>s.index)) assert.equal(segment.text,segment.index<=i?item.spelling[segment.index-1].answer:'？');
      assert.equal(revealPlan(q).continuation,i>0);
      if(i<stages.length-1){assert.equal(q.note,'');assert.ok(!q.task.includes(item.english));assert.ok(!q.reviewLabel.includes(item.english));}
    }
  }
  const ground=makeSpellingQuestions(english[0]);
  assert.deepEqual(ground.map(q=>q.answer),['gr','ou','nd']);
  assert.ok(ground[0].choices.includes('gr'));assert.ok(ground[0].choices.includes('gl'));
});
test('mixed subjects expose all five formats early and keep spelling groups contiguous',()=>{
  const queue=makeQuestionQueue([...questions,...english],()=>.5);
  const expected=186+64+english.reduce((n,q)=>n+(q.spelling||q.phrase_blanks).length,0);
  assert.equal(queue.length,expected);
  assert.ok(queue.slice(0,15).some(q=>q.subject==='英語'));assert.ok(queue.slice(0,15).some(q=>q.subject==='理科'));assert.equal(new Set(queue.map(q=>q.mode)).size,6);
  for(let i=0;i<queue.length;i++){
    const q=queue[i];
    if(q.mode==='spelling'&&q.blankPosition>1){assert.equal(queue[i-1].sourceId,q.sourceId);assert.equal(queue[i-1].blankPosition,q.blankPosition-1);}
  }
});
test('spelling retries a wrong chunk and advances without rhythm or reanimation until complete',()=>{
  const g=new Game([english[0]],[],0,()=>.5);
  g.questionIndex=g.questions.findIndex(q=>q.mode==='spelling');g.changePhase('answer',0);
  const start=g.questionIndex;
  for(let t=2;t<=4;t++)hit(g,(g.question.correct+1)%4,t);
  assert.equal(g.questionIndex,start);assert.equal(g.question.blankPosition,1);assert.equal(g.phase,'answer');
  for(let t=5;t<=7;t++)hit(g,g.question.correct,t);
  g.update(9.5);assert.equal(g.phase,'read');assert.equal(g.question.blankPosition,2);
  assert.equal(g.reveal.continuation,true);assert.equal(g.question.prompt,'gr？？');
  assert.deepEqual(g.counts,[0,0,0,0]);
  g.changePhase('answer',10);
  for(let t=12;t<=14;t++)hit(g,g.question.correct,t);
  g.update(16.5);assert.equal(g.question.blankPosition,3);assert.equal(g.question.prompt,'grou？');
  g.changePhase('answer',17);
  for(let t=19;t<=21;t++)hit(g,g.question.correct,t);
  g.events=[{id:1,target:26,lane:0}];g.cursor=0;
  g.update(23.5);assert.equal(g.phase,'rhythm');assert.equal(g.correctCount,3);
});

test('all spelling alternatives have the requested length and cannot complete the target with another split',()=>{
  for(const item of english){
    if(item.phrase_blanks) continue;
    const stages=makeSpellingQuestions(item);
    for(const q of stages){
      const position=item.spelling_template.indexOf('{{'+q.blankIndex+'}}');
      const rest=item.spelling_template.slice(position).replace(/\{\{(\d+)\}\}/g,(_,n)=>item.spelling.find(b=>b.index===Number(n)).answer);
      assert.ok(q.targetLabel.includes(`${q.answer.length}文字`));
      for(const choice of q.choices){
        assert.equal(choice.length,q.answer.length,`${item.english}: ${choice}`);
        assert.equal(rest.startsWith(choice),choice===q.answer,`${item.english}: ambiguous ${choice}`);
      }
    }
  }
  const arrive=english.find(q=>q.english==='arrive');
  const first=makeSpellingQuestions(arrive)[0];
  assert.equal(first.answer,'ar');assert.ok(!first.choices.includes('arr'));assert.ok(!first.choices.includes('a'));
  assert.throws(()=>makeSpellingQuestions({...arrive,spelling:arrive.spelling.map((b,i)=>i===0?{...b,dummies:['arr','ra','a']}:b)}),/same length/);
});

const secondTrack=read('../music-data/index.json')['0002'];
const secondChart=read(`../music-data/${secondTrack.files.chart}`);
test('second track reads all main beats without interpreting offbeats as primary beats',()=>{
  assert.equal(secondTrack.title,'American Western Country');assert.equal(secondTrack.creator,'The_Mountain');
  assert.equal(secondChart.events.length,420);assert.equal(easyEvents(secondChart.events).length,211);
  assert.ok(easyEvents(secondChart.events).every(e=>['beat','accent'].includes(e.type)));
  assert.ok(secondChart.events.every((e,i,all)=>e.time>=0&&e.time<secondTrack.durationSeconds&&(!i||e.time>=all[i-1].time)));
  for(const file of Object.values(secondTrack.files))assert.ok(readFileSync(new URL(`../music-data/${file}`,import.meta.url)).length);
});
test('playlist preserves both charts, applies per-song and device offsets once, and retains distinct bars',()=>{
  const p=makePlaylist([{id:'0001',track:{...track,timing:{chartToAudioOffsetMs:25}},chart},
    {id:'0002',track:{...secondTrack,timing:{chartToAudioOffsetMs:-35}},chart:secondChart}],{trim:false});
  assert.equal(p.tracks[1].start,track.durationSeconds);assert.equal(p.duration,track.durationSeconds+secondTrack.durationSeconds);
  assert.equal(p.events.length,661);assert.equal(easyEvents(p.events).length,661);
  assert.equal(p.events[0].time,easyEvents(chart.events)[0].time+.025);
  assert.equal(p.events[450].time,track.durationSeconds+easyEvents(secondChart.events)[0].time-.035);
  const g=new Game(questions,p.events,.1);assert.equal(g.events[450].target,p.events[450].time+.1);
  assert.equal(g.events.length,661);
});
test('continuous song clock keeps answer progress and reading animation through a track boundary',()=>{
  const p=makePlaylist([{id:'0001',track,chart},{id:'0002',track:secondTrack,chart:secondChart}]);
  const g=new Game(questions,p.events);g.changePhase('answer',p.tracks[1].start-1);
  g.rhythmScore=500;g.quizScore=1000;g.combo=4;g.quizCombo=1;g.counts=[1,2,0,0];g.firstTry=false;
  g.cursor=g.events.findIndex(e=>e.target>p.tracks[1].start);
  g.update(p.tracks[1].start-.01);g.update(p.tracks[1].start+.01);
  assert.equal(g.phase,'answer');assert.deepEqual(g.counts,[1,2,0,0]);assert.equal(g.rhythmScore,500);
  assert.equal(g.quizScore,1000);assert.equal(g.combo,4);assert.equal(g.quizCombo,1);assert.equal(g.firstTry,false);
  g.changePhase('read',p.tracks[1].start-1);const plan=g.reveal;
  g.update(p.tracks[1].start+.01);assert.equal(g.phase,'read');assert.equal(g.reveal,plan);
  assert.equal(g.phaseStart,p.tracks[1].start-1);
});

test('all idioms ask whole words with the other words visible; take care of covers all three positions',()=>{
  let count=0;
  for(const item of english.filter(q=>q.phrase_blanks)){
    assert.equal(item.spelling,undefined);const stages=makePhraseQuestions(item);count+=stages.length;
    for(const [i,q] of stages.entries()){
      const words=item.english.split(' ');words[q.blankIndex-1]='？';
      assert.equal(q.prompt,words.join(' '));assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
      assert.equal(q.answer,item.english.split(' ')[q.blankIndex-1]);assert.equal(q.choices[q.correct],q.answer);
      assert.equal(q.segments.filter(s=>s.state==='active').length,1);assert.equal(revealPlan(q).continuation,false);
      assert.ok(q.targetLabel.includes('単語'));assert.ok(!q.targetLabel.includes('文字'));
    }
  }
  assert.equal(count,21);
  const item=english.find(q=>q.english==='take care of'),stages=makePhraseQuestions(item);
  assert.deepEqual(stages.map(q=>q.prompt),['？ care of','take ？ of','take care ？']);
  assert.deepEqual(stages.map(q=>q.answer),['take','care','of']);
  const g=new Game([item],[],0,()=>.5);g.questionIndex=g.questions.findIndex(q=>q.mode==='phrase');g.changePhase('answer',0);
  for(let t=2;t<=4;t++)hit(g,(g.question.correct+1)%4,t);
  assert.equal(g.question.blankPosition,1);assert.equal(g.phase,'answer');
  for(let t=5;t<=7;t++)hit(g,g.question.correct,t);
  g.update(9.5);assert.equal(g.question.prompt,'take ？ of');assert.equal(g.reveal.continuation,false);assert.deepEqual(g.counts,[0,0,0,0]);
});

test('result counters count timing judgments, empty taps and one miss per colored row', () => {
  const g = fixture();
  g.notes.push({target:2,lane:0,color:null,done:false}); g.tap(0,2);
  g.notes.push({target:3,lane:1,color:null,done:false}); g.tap(1,3.12);
  g.tap(3,4);
  assert.deepEqual(g.judgments,{PERFECT:1,GOOD:1,MISS:1});
  g.phase='answer'; g.phaseStart=0;
  for(let lane=0;lane<4;lane++)g.notes.push({target:5,lane,color:lane,rowId:77,done:false});
  g.update(5.2); g.update(5.3);
  assert.deepEqual(g.judgments,{PERFECT:1,GOOD:1,MISS:2});
  g.changePhase('read',6);g.tap(0,6);g.finish();g.tap(0,7);
  assert.deepEqual(g.judgments,{PERFECT:1,GOOD:1,MISS:2});
});
test('wrong answers count per confirmation, retries count once each, cleared notes add no miss', () => {
  const g=fixture();g.changePhase('answer',0);
  const wrong=(g.question.correct+1)%4;
  hit(g,wrong,2);hit(g,wrong,3);assert.equal(g.wrongCount,0);
  hit(g,wrong,4);assert.equal(g.wrongCount,1);
  for(const t of [5,6,7])hit(g,wrong,t);
  assert.equal(g.wrongCount,2);
  hit(g,g.question.correct,8);hit(g,g.question.correct,9);
  g.notes.push({target:11,lane:1,color:1,rowId:100,done:false});
  hit(g,g.question.correct,10);g.update(11.3);
  assert.equal(g.correctCount,1);assert.equal(g.firstCount,0);
  assert.deepEqual(g.judgments,{PERFECT:9,GOOD:0,MISS:0});
});
test('completion awards require complete positive play with no mistakes or unanswered question', () => {
  const g=fixture();
  assert.deepEqual(g.achievements(true),{rhythm:false,quiz:false,double:false,allPerfect:false});
  g.judgments.PERFECT=9;g.judgments.GOOD=1;g.correctCount=2;
  assert.deepEqual(g.achievements(false),{rhythm:false,quiz:false,double:false,allPerfect:false});
  assert.deepEqual(g.achievements(true),{rhythm:true,quiz:true,double:true,allPerfect:false});
  assert.equal(g.achievements(true,true).quiz,false);
  g.judgments.GOOD=0;assert.equal(g.achievements(true).allPerfect,true);
  g.wrongCount=1;assert.equal(g.achievements(true).quiz,false);
  g.judgments.MISS=1;assert.equal(g.achievements(true).rhythm,false);
  const fresh=fixture();assert.equal(fresh.wrongCount,0);assert.equal(fresh.judgments.PERFECT,0);
});

test('rhythm score adds base plus the new combo and starts from one after MISS', () => {
  const g=fixture();hit(g,null,2);hit(g,null,3);
  const before=g.totalScore;hit(g,null,4,.12);
  assert.equal(g.combo,3);assert.equal(g.totalScore-before,8);
  assert.equal(g.rhythmScore,11+12+8);
  g.tap(0,5);const afterMiss=g.totalScore;assert.equal(afterMiss,31);
  hit(g,null,6,.12);assert.equal(g.combo,1);assert.equal(g.totalScore-afterMiss,6);
  g.notes.push({target:7,lane:0,color:null});g.update(7.2);const beforePerfect=g.totalScore;
  hit(g,null,8);assert.equal(g.totalScore-beforePerfect,11);
});
test('answers award 50 plus first-answer streak times ten, retry earns 50, total includes timing points', () => {
  const g=fixture();let now=2;
  const confirm=color=>{for(let i=0;i<3;i++)hit(g,color,now++);};
  for(let stage=1;stage<=3;stage++){
    g.changePhase('answer',now-2);g.firstTry=true;const before=g.quizScore;
    confirm(g.question.correct);assert.equal(g.quizScore-before,50+stage*10);
    assert.equal(g.quizCombo,stage);assert.equal(g.totalScore,g.rhythmScore+g.quizScore);
    now+=3;g.questionIndex++;
  }
  assert.equal(g.quizScore,210);
  g.changePhase('answer',now-2);g.firstTry=true;
  const beforeWrong=g.quizScore;confirm((g.question.correct+1)%4);confirm((g.question.correct+1)%4);
  assert.equal(g.quizScore,beforeWrong);assert.equal(g.wrongCount,2);assert.equal(g.quizCombo,0);
  confirm(g.question.correct);assert.equal(g.quizScore-beforeWrong,50);assert.equal(g.quizCombo,0);
  now+=3;g.questionIndex++;g.changePhase('answer',now-2);g.firstTry=true;
  const beforeRestart=g.quizScore;confirm(g.question.correct);
  assert.equal(g.quizScore-beforeRestart,60);assert.equal(g.quizCombo,1);
  assert.equal(g.correctCount,5);assert.equal(g.firstCount,4);
});

test('continuation reveals only new choices in order and waits before enabling notes',()=>{
 const item=questions.find(q=>q.blanks.length>1),q=makeBlankQuestions(item)[1],plan=revealPlan(q);
 assert.equal(plan.continuation,true);assert.deepEqual(plan.context,{start:0,end:0});assert.deepEqual(plan.prompt,{start:0,end:0});
 for(let i=0;i<4;i++){
  assert.ok(plan.choices[i].end>plan.choices[i].start);
  if(i)assert.ok(plan.choices[i].start>=plan.choices[i-1].end+RULES.choiceGapSeconds-1e-9);
 }
 assert.equal(plan.revealEnd,plan.choices.at(-1).end);assert.equal(plan.duration,plan.revealEnd+RULES.readHoldSeconds);
 const g=new Game([item],chart.events,0,()=>.5);g.questionIndex=g.questions.findIndex(q=>q.blankPosition===2);g.changePhase('read',8);
 g.update(8+plan.revealEnd);assert.equal(g.phase,'read');assert.equal(g.notes.length,0);
 g.tap(0,8+plan.revealEnd);assert.equal(g.judgments.MISS,0);
 g.update(8+plan.duration+.01);assert.equal(g.phase,'answer');
});

test('colored hits use fixed one/two points, wrong confirmation resets both combos and voids full-combo praise',()=>{
 const g=fixture();g.changePhase('answer',0);g.combo=99;g.quizCombo=4;const wrong=(g.question.correct+1)%4;
 hit(g,wrong,2,.12);assert.equal(g.rhythmScore,1);
 hit(g,wrong,3);assert.equal(g.rhythmScore,3);
 hit(g,wrong,4);assert.equal(g.rhythmScore,5);assert.equal(g.combo,0);assert.equal(g.quizCombo,0);assert.equal(g.wrongCount,1);
 assert.equal(g.judgments.MISS,0);assert.equal(g.achievements(true).rhythm,false);
 hit(g,g.question.correct,5);assert.equal(g.combo,1);assert.equal(g.rhythmScore,7);assert.equal(g.rhythmComboScore,0);
 g.changePhase('outro',6);hit(g,null,8);assert.equal(g.rhythmScore,19);assert.equal(g.rhythmBaseScore,17);assert.equal(g.rhythmComboScore,2);
 assert.equal(g.rhythmScore,g.rhythmBaseScore+g.rhythmComboScore);
});
test('deliberately repeating wrong color answers cannot build an unbroken rhythm streak or outscore prompt correct play',()=>{
 const good=fixture(),bad=fixture();good.changePhase('answer',0);bad.changePhase('answer',0);
 for(let t=2;t<=4;t++)hit(good,good.question.correct,t);
 good.changePhase('outro',5);for(let t=6;t<18;t++)hit(good,null,t);
 for(let t=2;t<17;t++)hit(bad,(bad.question.correct+1)%4,t);
 assert.equal(bad.wrongCount,5);assert.equal(bad.combo,0);assert.equal(bad.maxCombo,3);assert.equal(bad.rhythmScore,30);
 assert.ok(good.totalScore>bad.totalScore);assert.equal(good.correctCount,1);
});

test('judgment center returns to the target without changing chart targets or widths',async()=>{
 const {timingError}=await import('../game.js');assert.equal(RULES.judgmentOffsetSeconds,0);
 assert.equal(RULES.perfectWindow,.08);assert.equal(RULES.goodWindow,.16);assert.ok(Math.abs(timingError(2,2))<1e-12);
 const shifted=new Game(questions,chart.events,.1);assert.equal(shifted.events[0].target,easyEvents(chart.events)[0].time+.1);
 const cases=[[-.08,'PERFECT'],[-.081,'GOOD'],[.08,'PERFECT'],[.081,'GOOD'],[-.16,'GOOD'],[-.161,'MISS'],[.16,'GOOD'],[.161,'MISS']];
 for(const colored of [false,true])for(const [offset,label] of cases){
  const g=fixture();if(colored)g.changePhase('answer',0);
  hit(g,colored?g.question.correct:null,2,offset);assert.equal(g.lastJudgment,label,`${colored?'color':'white'} ${offset}`);
 }
});
test('late miss deadline returns to the unshifted target and a missed color row counts once',()=>{
 const g=fixture();g.notes=[{target:2,lane:0,color:null,done:false}];g.update(2.16);assert.equal(g.notes.length,1);g.update(2.1601);assert.equal(g.notes.length,0);assert.equal(g.judgments.MISS,1);
 const c=fixture();c.changePhase('answer',0);c.notes=Array.from({length:4},(_,lane)=>({target:2,lane,color:lane,rowId:1,done:false}));c.update(2.161);assert.equal(c.judgments.MISS,1);
});
