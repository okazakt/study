import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, makeQuestion, RULES } from '../game.js';
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
  assert.equal(g.events[0].target, chart.events[0].time + .125);
  for (const path of Object.values(track.files)) assert.ok(readFileSync(new URL(`../music-data/${path}`, import.meta.url)).length);
});
test('white notes accept every lane; perfect, good, misses and empty taps affect rhythm only', () => {
  const g = fixture(); g.notes = [{target:2, color:null, lane:0}];
  g.tap(4, 2); assert.equal(g.rhythmScore, 100); assert.equal(g.combo, 1);
  hit(g, null, 3, .12); assert.equal(g.rhythmScore, 150); assert.equal(g.combo, 2);
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
  assert.equal(g.phase,'feedback'); assert.equal(g.correctCount,1); assert.equal(g.quizScore,1000);
  assert.equal(g.quizCombo,1); assert.equal(g.combo,3);
  g.update(4 + RULES.feedbackSeconds); assert.equal(g.phase,'read'); assert.equal(g.questionIndex,1);
  g.update(4 + RULES.feedbackSeconds + RULES.readSeconds); assert.equal(g.phase,'answer');
  const c2 = g.question.correct;
  hit(g,c2,14); hit(g,c2,15); hit(g,c2,16);
  assert.equal(g.quizScore,2000); assert.equal(g.quizCombo,2); assert.equal(g.maxQuizCombo,2);
});
test('wrong answers keep the same question and colors, reset progress, and break only quiz combo', () => {
  const g = fixture(); g.changePhase('answer',0); g.quizCombo = 2;
  const q = g.question, wrong = (q.correct + 1) % 4;
  hit(g,wrong,2); hit(g,wrong,3); hit(g,wrong,4);
  assert.equal(g.phase,'answer'); assert.equal(g.question,q); assert.equal(g.questionIndex,0);
  assert.equal(g.firstTry,false); assert.equal(g.quizCombo,0); assert.equal(g.combo,3);
  assert.deepEqual(g.counts,[0,0,0,0]);
  hit(g,q.correct,5); hit(g,q.correct,6); hit(g,q.correct,7);
  assert.equal(g.correctCount,1); assert.equal(g.firstCount,0); assert.equal(g.quizScore,0); assert.equal(g.phase,'feedback');
});
test('avoiding other colors is allowed; counts are independent until an answer is confirmed', () => {
  const g = fixture(); g.changePhase('answer',0); const c = g.question.correct;
  hit(g,c,2); g.notes.push({target:3,color:(c+1)%4,lane:0}); g.update(3.2);
  assert.equal(g.combo,1); assert.equal(g.counts[c],1);
  hit(g,(c+1)%4,4); hit(g,c,5); hit(g,c,6);
  assert.equal(g.phase,'feedback'); assert.equal(g.firstCount,1);
});
test('phase transitions discard stale notes without a penalty; finish forbids further scoring', () => {
  const g = fixture(); g.combo = 8; g.notes.push({target:8.1,color:null,lane:2}); g.update(RULES.introSeconds);
  assert.equal(g.phase,'read'); assert.equal(g.notes.length,0); assert.equal(g.combo,8);
  g.finish(); hit(g,null,10); assert.equal(g.rhythmScore,0); assert.equal(g.phase,'ended');
});
