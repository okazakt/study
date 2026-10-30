export const RULES = Object.freeze({ lanes: 4, tapsToAnswer: 3, introSeconds: 8, rhythmNotes: 8,
  charSeconds: 0.18, fadeSeconds: 0.65, choiceGapSeconds: 1.2, readHoldSeconds: 2.5, liftSeconds: 0.65,
  feedbackSeconds: 2.5, judgmentSeconds: 0.9, wrongResultSeconds: 1.5, travelSeconds: 1.8, perfectWindow: 0.08, goodWindow: 0.16 });
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
  return { ...item, mode: 'explanation_to_term', answer: item.term, prompt: explanation, choices, correct: choices.indexOf(item.term), context: '', task: '次の説明にあてはまる用語を選ぼう', reviewLabel: item.term };
}
export function makeBlankQuestions(item, random = Math.random) {
  const blanks = [...item.blanks].sort((a, b) => a.index - b.index);
  return blanks.map((blank, position) => {
    const candidates = [...new Set(blank.dummies)].filter(value => value !== blank.answer);
    if (candidates.length < 3) throw new Error(`${item.id}: insufficient choices for blank ${blank.index}`);
    const choices = shuffle([blank.answer, ...shuffle(candidates, random).slice(0, 3)], random);
    const segments = [];
    let cursor = 0;
    for (const match of item.explanation_template.matchAll(/\{\{(\d+)\}\}/g)) {
      if (match.index > cursor) segments.push({ text: item.explanation_template.slice(cursor, match.index) });
      const index = Number(match[1]), target = blanks.find(b => b.index === index);
      if (!target) throw new Error(`${item.id}: missing blank ${index}`);
      const state = index < blank.index ? 'solved' : index === blank.index ? 'active' : 'pending';
      segments.push({ text: state === 'solved' ? target.answer : '？', state, index });
      cursor = match.index + match[0].length;
    }
    segments.push({ text: item.explanation_template.slice(cursor) });
    return { ...item, id: `${item.id}:blank:${blank.index}`, sourceId: item.id, mode: 'term_to_explanation',
      blankIndex: blank.index, blankPosition: position + 1, blankTotal: blanks.length,
      answer: blank.answer, choices, correct: choices.indexOf(blank.answer), segments,
      prompt: segments.map(s => s.text).join(''), context: item.term, task: `「${item.term}」の説明を完成させよう`,
      targetLabel: `${position ? '次の' : '強調された'}？に入る語句を回答（${position + 1} / ${blanks.length}）`,
      reviewLabel: `${item.term} · ？（${position + 1} / ${blanks.length}）` };
  });
}
export function makeQuestionQueue(items, random = Math.random) {
  const terms = shuffle(items, random).map(item => makeQuestion(item, random));
  const blanks = shuffle(items, random).map(item => makeBlankQuestions(item, random));
  // Alternate directions by source group; keep all blanks of one explanation together.
  return blanks.flatMap((group, i) => [...group, terms[i]]);
}
// Preserve source timestamps and keep every main beat, excluding subdivisions.
export function easyEvents(events) {
  const beats = new Set();
  return events.filter(event => {
    const key = `${event.bar}:${event.beatInBar}`;
    if (event.beatPosition !== 0 || !Number.isInteger(event.beatInBar) || event.beatInBar < 1 || event.beatInBar > 4 || beats.has(key)) return false;
    beats.add(key); return true;
  });
}
export function answerProgress(count, required) {
  if (!Number.isFinite(required) || required <= 0 || !Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(1, count / required));
}
export function revealPlan(question) {
  if (question.mode === 'term_to_explanation' && question.blankPosition > 1) {
    return { continuation: true, context: { start: 0, end: 0 }, prompt: { start: 0, end: 0 },
      choices: question.choices.map(() => ({ start: 0, end: 0 })), revealEnd: 0,
      liftStart: 0, duration: RULES.readHoldSeconds };
  }
  let cursor = 0.2;
  const segment = text => {
    const start = cursor;
    cursor += Math.max(0, Array.from(text).length - 1) * RULES.charSeconds + RULES.fadeSeconds;
    return { start, end: cursor };
  };
  const context = question.context ? segment(question.task || question.context) : { start: 0, end: 0 };
  if (question.context) cursor += RULES.choiceGapSeconds;
  const prompt = segment(question.prompt);
  const choices = question.choices.map(text => { cursor += RULES.choiceGapSeconds; return segment(text); });
  const liftStart = cursor + RULES.readHoldSeconds;
  return { continuation: false, context, prompt, choices, revealEnd: cursor, liftStart, duration: liftStart + RULES.liftSeconds };
}
export class Game {
  constructor(questions, events, offsetSeconds = 0, random = Math.random) {
    this.questions = makeQuestionQueue(questions, random);
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
    this.quizResult = null;
    this.lastJudgment = ''; this.judgmentTime = -10; this.time = 0;
  }
  get requiredTaps() {
    const value = this.question.tapsToAnswer;
    return Number.isInteger(value) && value > 0 ? value : RULES.tapsToAnswer;
  }
  get laneCount() { return RULES.lanes; }
  get question() { return this.questions[this.questionIndex % this.questions.length]; }
  changePhase(phase, now) {
    this.phase = phase; this.phaseStart = now;
    if (phase === 'read') { this.reveal = revealPlan(this.question); this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = ''; this.quizResult = null; }
    if (phase === 'rhythm') {
      this.quizResult = null; this.message = '';
      const targets = this.events.slice(this.cursor).filter(e => e.target >= now + RULES.travelSeconds).slice(0, RULES.rhythmNotes);
      this.rhythmTargets = new Set(targets.map(e => e.id));
      this.rhythmEnd = (targets.at(-1)?.target ?? now) + RULES.goodWindow + RULES.judgmentSeconds;
    }
    if (phase === 'answer') this.message = `答えの色を${this.requiredTaps}回タップ`;
  }
  update(now) {
    this.time = now;
    if (this.phase === 'ended') return;
    if (this.phase === 'read' && now - this.phaseStart + 1e-9 >= this.reveal.duration) this.changePhase('answer', now);
    while (this.cursor < this.events.length && this.events[this.cursor].target <= now + RULES.travelSeconds) {
      const event = this.events[this.cursor++];
      if (!['intro', 'answer', 'rhythm'].includes(this.phase)) continue;
      if (this.phase === 'rhythm' && !this.rhythmTargets.has(event.id)) continue;
      if (event.target < this.phaseStart + RULES.travelSeconds) continue;
      // Do not launch a note that cannot be judged and displayed before the intro ends.
      if (this.phase === 'intro' && event.target + RULES.goodWindow + RULES.judgmentSeconds > RULES.introSeconds) continue;
      if (this.phase === 'answer') {
        COLORS.forEach((_, color) => this.notes.push({ ...event, rowId: event.id, lane: color, color, done: false }));
      } else this.notes.push({ ...event, color: null, done: false });
    }
    for (const note of this.notes) {
      if (!note.done && now - note.target > RULES.goodWindow) {
        note.done = true;
        // An unanswered four-color row is one miss; unchosen siblings are not misses.
        if (note.rowId !== undefined) {
          for (const sibling of this.notes) if (sibling.rowId === note.rowId) sibling.done = true;
        }
        this.combo = 0; this.judge('MISS', now);
      }
    }
    this.notes = this.notes.filter(note => !note.done);
    const settled = !this.notes.length && now - this.judgmentTime >= RULES.judgmentSeconds;
    if (this.phase === 'intro' && now >= RULES.introSeconds && settled) this.changePhase('read', now);
    else if (this.phase === 'feedback' && now - this.phaseStart >= RULES.feedbackSeconds && settled) {
      const next = this.questions[(this.questionIndex + 1) % this.questions.length];
      if (next.mode === 'term_to_explanation' && next.blankPosition > 1) {
        this.questionIndex++; this.changePhase('read', now);
      } else if (this.events.slice(this.cursor).some(e => e.target >= now + RULES.travelSeconds)) this.changePhase('rhythm', now);
      else { this.questionIndex++; this.changePhase('read', now); }
    } else if (this.phase === 'rhythm' && now >= this.rhythmEnd && settled) {
      this.questionIndex++; this.changePhase('read', now);
    }
  }
  judge(label, now) { this.lastJudgment = label; this.judgmentTime = now; }
  tap(lane, now) {
    if (this.phase === 'ended') return null;
    this.update(now);
    if (this.phase === 'read' || (this.phase === 'feedback' && !this.notes.length)) return null;
    const note = this.notes.filter(n => !n.done && n.lane === lane && Math.abs(n.target - now) <= RULES.goodWindow)
      .sort((a, b) => Math.abs(a.target - now) - Math.abs(b.target - now))[0];
    if (!note) { this.combo = 0; this.judge('MISS', now); return null; }
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
      if (this.counts[note.color] >= this.requiredTaps) {
        if (note.color === this.question.correct) {
          this.quizResult = { correct: true, time: now, choice: note.color };
          this.correctCount++;
          if (this.firstTry) { this.quizScore += 1000; this.firstCount++; this.maxQuizCombo = Math.max(this.maxQuizCombo, ++this.quizCombo); }
          this.message = this.firstTry ? '一発正解！ +1,000 pt' : '正解！ 覚えて次へ進もう';
          this.changePhase('feedback', now);
        } else {
          this.quizResult = { correct: false, time: now, choice: note.color };
          this.firstTry = false; this.quizCombo = 0; this.counts = [0, 0, 0, 0];
          this.message = `もう一度！ 正解だと思う色を${this.requiredTaps}回タップ`;
        }
      }
    }
    return note;
  }
  finish() { this.phase = 'ended'; this.notes = []; }
}
