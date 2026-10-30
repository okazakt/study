export const RULES = Object.freeze({ lanes: 5, tapsToAnswer: 3, readSeconds: 6, introSeconds: 8,
  feedbackSeconds: 2.5, travelSeconds: 1.8, perfectWindow: 0.08, goodWindow: 0.16 });
export const COLORS = [
  { name: '赤', symbol: '●', value: '#ff7187' }, { name: '青', symbol: '◆', value: '#73b9ff' },
  { name: '黄', symbol: '▲', value: '#ffda79' }, { name: '緑', symbol: '■', value: '#71e1bc' }
];
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function makeQuestion(item, random = Math.random) {
  const explanation = item.explanation_template.replace(/\{\{(\d+)\}\}/g, (_, index) => {
    const blank = item.blanks.find(b => b.index === Number(index));
    if (!blank) throw new Error(`${item.id}: missing blank ${index}`);
    return blank.answer;
  });
  const dummies = [...new Set(item.term_dummies)].filter(term => term !== item.term);
  if (dummies.length < 3) throw new Error(`${item.id}: insufficient choices`);
  const choices = shuffle([item.term, ...shuffle(dummies, random).slice(0, 3)], random);
  return { ...item, prompt: explanation, choices, correct: choices.indexOf(item.term) };
}
export class Game {
  constructor(questions, events, offsetSeconds = 0, random = Math.random) {
    this.questions = shuffle(questions, random).map(q => makeQuestion(q, random));
    this.events = events.map((event, i) => ({ target: event.time + offsetSeconds, lane: i % RULES.lanes, color: i % 4, id: i }));
    this.phase = 'intro'; this.phaseStart = 0; this.cursor = 0; this.notes = []; this.questionIndex = 0;
    this.rhythmScore = 0; this.quizScore = 0; this.combo = 0; this.maxCombo = 0;
    this.quizCombo = 0; this.maxQuizCombo = 0; this.correctCount = 0; this.firstCount = 0;
    this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = '音楽に合わせて、白いノーツをタップ';
    this.lastJudgment = ''; this.judgmentTime = -10; this.time = 0;
  }
  get question() { return this.questions[this.questionIndex % this.questions.length]; }
  changePhase(phase, now) {
    this.phase = phase; this.phaseStart = now;
    // Phase-specific notes must never be interpreted as another question or color mode.
    this.notes = [];
    if (phase === 'read') { this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = '説明にあてはまる用語は？ まずは読もう'; }
    if (phase === 'answer') this.message = `答えの色を${RULES.tapsToAnswer}回タップ`;
  }
  update(now) {
    this.time = now;
    if (this.phase === 'ended') return;
    if (this.phase === 'intro' && now - this.phaseStart >= RULES.introSeconds) this.changePhase('read', now);
    else if (this.phase === 'read' && now - this.phaseStart >= RULES.readSeconds) this.changePhase('answer', now);
    else if (this.phase === 'feedback' && now - this.phaseStart >= RULES.feedbackSeconds) {
      this.questionIndex++; this.changePhase('read', now);
    }
    for (const note of this.notes) {
      if (!note.done && now - note.target > RULES.goodWindow) {
        note.done = true;
        // Other colors are choices, not mandatory rhythm targets.
        if (note.color === null) { this.combo = 0; this.judge('MISS', now); }
      }
    }
    this.notes = this.notes.filter(note => now - note.target <= 0.3 && !note.done);
    while (this.cursor < this.events.length && this.events[this.cursor].target <= now + RULES.travelSeconds) {
      const event = this.events[this.cursor++];
      if (event.target < this.phaseStart + RULES.travelSeconds || event.target < now) continue;
      this.notes.push({ ...event, color: this.phase === 'answer' ? event.color : null, done: false });
    }
  }
  judge(label, now) { this.lastJudgment = label; this.judgmentTime = now; }
  tap(lane, now) {
    if (this.phase === 'ended') return null;
    this.update(now);
    const note = this.notes.filter(n => !n.done && (n.color === null || n.lane === lane) && Math.abs(n.target - now) <= RULES.goodWindow)
      .sort((a, b) => Math.abs(a.target - now) - Math.abs(b.target - now))[0];
    if (!note) { this.combo = 0; this.judge('空振り', now); return null; }
    note.done = true;
    const perfect = Math.abs(note.target - now) <= RULES.perfectWindow;
    this.rhythmScore += perfect ? 100 : 50;
    this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    this.judge(perfect ? 'PERFECT' : 'GOOD', now);
    if (this.phase === 'answer' && note.color !== null) {
      this.counts[note.color]++;
      if (this.counts[note.color] === RULES.tapsToAnswer) {
        if (note.color === this.question.correct) {
          this.correctCount++;
          if (this.firstTry) { this.quizScore += 1000; this.firstCount++; this.maxQuizCombo = Math.max(this.maxQuizCombo, ++this.quizCombo); }
          this.message = this.firstTry ? '一発正解！ +1,000 pt' : '正解！ 覚えて次へ進もう';
          this.changePhase('feedback', now);
        } else {
          this.firstTry = false; this.quizCombo = 0; this.counts = [0, 0, 0, 0];
          this.message = 'もう一度！ 正解だと思う色を3回タップ';
        }
      }
    }
    return note;
  }
  finish() { this.phase = 'ended'; this.notes = []; }
}
