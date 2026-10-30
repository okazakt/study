export const RULES = Object.freeze({ lanes: 4, tapsToAnswer: 3, introSeconds: 8,
  charSeconds: 0.18, fadeSeconds: 0.65, choiceGapSeconds: 1.2, readHoldSeconds: 2.5, liftSeconds: 0.65,
  feedbackSeconds: 2.5, travelSeconds: 1.8, perfectWindow: 0.08, goodWindow: 0.16 });
export const COLORS = [
  { name: '赤', value: '#ff7187' }, { name: '青', value: '#73b9ff' },
  { name: '黄', value: '#ffda79' }, { name: '緑', value: '#71e1bc' }
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
// Keep the original corrected timestamps; select just the first beat of each bar.
export function easyEvents(events) {
  const bars = new Set();
  return events.filter(event => {
    if (event.beatInBar !== 1 || event.beatPosition !== 0 || bars.has(event.bar)) return false;
    bars.add(event.bar); return true;
  });
}
export function revealPlan(question) {
  let cursor = 0.2;
  const segment = text => {
    const start = cursor;
    cursor += Math.max(0, Array.from(text).length - 1) * RULES.charSeconds + RULES.fadeSeconds;
    return { start, end: cursor };
  };
  const prompt = segment(question.prompt);
  const choices = question.choices.map(text => { cursor += RULES.choiceGapSeconds; return segment(text); });
  const liftStart = cursor + RULES.readHoldSeconds;
  return { prompt, choices, revealEnd: cursor, liftStart, duration: liftStart + RULES.liftSeconds };
}
export class Game {
  constructor(questions, events, offsetSeconds = 0, random = Math.random) {
    this.questions = shuffle(questions, random).map(q => makeQuestion(q, random));
    let lanes = [];
    this.events = easyEvents(events).map((event, i) => {
      if (!lanes.length) lanes = shuffle([0, 1, 2, 3], random);
      return { target: event.time + offsetSeconds, id: i, lane: lanes.pop() };
    });
    this.reveal = revealPlan(this.questions[0]);
    this.phase = 'intro'; this.phaseStart = 0; this.cursor = 0; this.notes = []; this.questionIndex = 0;
    this.rhythmScore = 0; this.quizScore = 0; this.combo = 0; this.maxCombo = 0;
    this.quizCombo = 0; this.maxQuizCombo = 0; this.correctCount = 0; this.firstCount = 0;
    this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = '白いノーツが来たレーンを、音楽に合わせてタップ';
    this.lastJudgment = ''; this.judgmentTime = -10; this.time = 0;
  }
  get laneCount() { return RULES.lanes; }
  get question() { return this.questions[this.questionIndex % this.questions.length]; }
  changePhase(phase, now) {
    this.phase = phase; this.phaseStart = now;
    // Phase-specific notes must never be interpreted as another question or color mode.
    this.notes = [];
    if (phase === 'read') { this.reveal = revealPlan(this.question); this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = '今はタップをお休み。問題と選択肢をゆっくり読もう'; }
    if (phase === 'answer') this.message = `答えの色を${RULES.tapsToAnswer}回タップ`;
  }
  update(now) {
    this.time = now;
    if (this.phase === 'ended') return;
    if (this.phase === 'intro' && now - this.phaseStart >= RULES.introSeconds) this.changePhase('read', now);
    else if (this.phase === 'read' && now - this.phaseStart >= this.reveal.duration) this.changePhase('answer', now);
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
      if (this.phase === 'read') continue;
      if (event.target < this.phaseStart + RULES.travelSeconds || event.target < now) continue;
      if (this.phase === 'answer') {
        COLORS.forEach((_, color) => this.notes.push({ ...event, rowId: event.id, lane: color, color, done: false }));
      } else this.notes.push({ ...event, color: null, done: false });
    }
  }
  judge(label, now) { this.lastJudgment = label; this.judgmentTime = now; }
  tap(lane, now) {
    if (this.phase === 'ended') return null;
    this.update(now);
    if (this.phase === 'read') return null;
    const note = this.notes.filter(n => !n.done && n.lane === lane && Math.abs(n.target - now) <= RULES.goodWindow)
      .sort((a, b) => Math.abs(a.target - now) - Math.abs(b.target - now))[0];
    if (!note) { this.combo = 0; this.judge('空振り', now); return null; }
    note.done = true;
    if (note.rowId !== undefined) {
      for (const sibling of this.notes) if (sibling.rowId === note.rowId) sibling.done = true;
    }
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
