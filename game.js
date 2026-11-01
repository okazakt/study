import { materializeMathItem } from './math-variants.js?v=0.48.0';
export const RULES = Object.freeze({ lanes: 4, tapsToAnswer: 3, introSeconds: 8, rhythmNotes: 8,
  charSeconds: 0.18, fadeSeconds: 0.65, choiceGapSeconds: 1.2, readHoldSeconds: 2.5, liftSeconds: 0.65,
  feedbackSeconds: 2.5, judgmentSeconds: 0.9, wrongResultSeconds: 1.5, travelSeconds: 1.8, perfectWindow: 0.08, goodWindow: 0.16, judgmentOffsetSeconds: 0 });
export const SESSION = Object.freeze({durationSeconds:300,fadeSeconds:3,tapGoal:120,minWhiteInterval:.22});
export const SPEEDS=Object.freeze({slow:'ゆっくり',normal:'普通',fast:'速い',instant:'即答級'});
export const RHYTHMS=Object.freeze({easy:{label:'イージー',tapGoal:120},normal:{label:'ノーマル',tapGoal:180},hard:{label:'ハード',tapGoal:240}});
export function normalizeGameplayOptions(value){return {speed:Object.hasOwn(SPEEDS,value?.speed)?value.speed:'slow',rhythm:Object.hasOwn(RHYTHMS,value?.rhythm)?value.rhythm:'easy'};}
export function sessionPlan(playlistSeconds, limit=SESSION.durationSeconds) {
  const endTime=Math.min(playlistSeconds,limit);
  return {endTime,fadeStart:playlistSeconds>limit?Math.max(0,endTime-SESSION.fadeSeconds):endTime};
}
export function sessionGain(now, plan) {
  if(now>=plan.endTime)return 0;
  if(plan.fadeStart>=plan.endTime)return 1;
  return Math.max(0,Math.min(1,(plan.endTime-now)/(plan.endTime-plan.fadeStart)));
}
export const SCORE = Object.freeze({white:5000,color:1000,answer:4000,answerRates:Object.freeze([1,.8,.5,0])});
export function seededRandom(seed){return()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
export function perfectReference(game,onCorrect=()=>{}){
  for(let tick=0;tick<=game.endTime*60;tick++){
    const now=tick/60;game.update(now);
    const note=game.notes.find(n=>!n.done && n.target<=now && Math.abs(n.target-now)<.08 && (n.color===null || n.color===game.question.correct));
    if(!note)continue;
    const q=game.question,index=game.questionIndex,before=game.correctCount;
    game.tap(note.lane,now);
    if(game.correctCount>before)onCorrect(q,index,now);
  }
  return {questions:game.correctCount,white:game.whiteJudgments,color:game.colorEligibleJudgments};
}
// Positive errors are late; the judgment center matches the corrected target.
export const timingError = (target, now) => now - (target + RULES.judgmentOffsetSeconds);
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
  return { ...item, sourceId: item.id, mode: 'explanation_to_term', answer: item.term, prompt: explanation, choices, correct: choices.indexOf(item.term), context: '', task: '次の説明にあてはまる用語を選ぼう', reviewLabel: item.term };
}
export function makeBlankQuestions(item, random = Math.random) {
  const context = item.cloze_context === undefined ? item.term : item.cloze_context;
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
      blankIndex: blank.index, blankPosition: position + 1, blankTotal: blanks.length, continuation: position > 0,
      answer: blank.answer, choices, correct: choices.indexOf(blank.answer), segments,
      prompt: segments.map(s => s.text).join(''), context, task: context ? `「${context}」の説明を完成させよう` : '説明文を完成させよう',
      targetLabel: `${position ? '次の' : '強調された'}？に入る語句を回答（${position + 1} / ${blanks.length}）`,
      reviewLabel: `${item.term} · ？（${position + 1} / ${blanks.length}）` };
  });
}
export function makeQuestionQueue(items, random = Math.random, acceptQuestion = () => true) {
  const subjects = [...new Set(items.map(item => item.subject))];
  const decks = subjects.map(subject => shuffle(items.filter(item => item.subject === subject), random));
  const ordered = [];
  for (let i = 0; i < Math.max(0, ...decks.map(deck => deck.length)); i++) for (const deck of decks) if (deck[i]) ordered.push(deck[i]);
  const groups = ordered.map(item => {
    if (item.kind === 'choice') return [[makeChoiceQuestion(item, random)]];
    if (item.subject === '国語') {
      const questions = makeJapaneseQuestions(item, random);
      return shuffle(item.kind === 'grammar' ? [questions.slice(0, -1), questions.slice(-1)]
        : item.kind === 'kanji' ? [questions.slice(0, 1), questions.slice(1)] : questions.map(q => [q]), random);
    }
    if (item.subject === '数学') return [makeBlankQuestions(item, random)];
    if (item.english) return shuffle([[[makeEnglishQuestion(item, 'to_japanese', random)]], [[makeEnglishQuestion(item, 'to_english', random)]],
      item.phrase_blanks ? makePhraseQuestions(item, random).map(q => [q]) : [makeSpellingQuestions(item, random)]], random).flat();
    return shuffle([makeBlankQuestions(item, random), [makeQuestion(item, random)]], random);
  }).map(units => units.map(group => group.filter(acceptQuestion)).filter(group => group.length));
  // One unit per source on each pass. Reuse the source order so shrinking
  // passes cannot put the same source at both sides of a pass boundary.
  const queue = [];
  for (let i = 0; i < Math.max(0, ...groups.map(group => group.length)); i++) {
    for (const group of groups) if (group[i]) queue.push(...group[i]);
  }
  return queue;
}
// A learning point has one direction; do not manufacture a reverse term quiz.
export function makeChoiceQuestion(item, random = Math.random) {
  item = materializeMathItem(item, random);
  const candidates = [...new Set(item.dummies)].filter(value => value !== item.answer);
  if (candidates.length !== 3) throw new Error(`${item.id}: expected three distinct distractors`);
  const choices = shuffle([item.answer, ...candidates], random);
  return { ...item, id: `${item.id}:choice`, sourceId: item.id, mode: 'learning_point',
    term: item.prompt, context: '', choices, correct: choices.indexOf(item.answer), reviewLabel: item.prompt };
}
export function makeJapaneseQuestions(item, random = Math.random) {
  const question = (mode, prompt, answer, dummies, task, extra = {}) => {
    const candidates = [...new Set(dummies)].filter(value => value !== answer);
    if (candidates.length < 3) throw new Error(`${item.id}: insufficient Japanese choices`);
    const choices = shuffle([answer, ...shuffle(candidates, random).slice(0, 3)], random);
    return { ...item, id: `${item.id}:${mode}`, sourceId: item.id, mode, prompt, answer, choices,
      correct: choices.indexOf(answer), context: '', task, reviewLabel: prompt, ...extra };
  };
  if (item.kind === 'kanji') return [
    question('kanji_reading', `「${item.word}」\n${item.sentence}`, item.reading, item.reading_dummies, 'かぎ括弧の語の読みを選ぼう'),
    ...item.writing_parts.map((part, position) => question('kanji_component', item.writing_hint, part.answer, part.dummies, '部品を順に選ぼう',
      { id: `${item.id}:kanji_component:${position + 1}`, blankIndex: position + 1, blankPosition: position + 1,
        blankTotal: item.writing_parts.length, continuation: position > 0,
        diagram: { parts: item.writing_parts.map((part, index) => ({ ...part, state: index < position ? 'solved' : index === position ? 'active' : 'pending' })) },
        targetLabel: `強調された？（${part.position}）の字形を選択（${position + 1} / ${item.writing_parts.length}）`,
        reviewLabel: `${item.writing_hint} · ${part.position}の字形（${position + 1} / ${item.writing_parts.length}）`,
        note: position + 1 === item.writing_parts.length ? `完成：${item.character}。${item.note}` : '' }))
  ];
  if (item.kind === 'idiom') return [
    question('japanese_definition', item.term, item.definition, item.definition_dummies, 'この熟語の意味を選ぼう'),
    question('japanese_term', item.definition, item.term, item.term_dummies, 'この説明にあてはまる熟語を選ぼう')
  ];
  if (item.kind === 'grammar') return [...makeBlankQuestions(item, random), makeQuestion(item, random)];
  throw new Error(`${item.id}: unknown Japanese kind`);
}
export function makePhraseQuestions(item, random = Math.random) {
  const words = item.english.split(' ');
  const blanks = [...item.phrase_blanks].sort((a, b) => a.index - b.index);
  return blanks.map((blank, i) => {
    if (words[blank.index - 1] !== blank.answer) throw new Error(`${item.id}: phrase position mismatch`);
    const candidates = [...new Set(blank.dummies)].filter(word => word !== blank.answer);
    if (candidates.length < 3) throw new Error(`${item.id}: insufficient phrase choices`);
    const choices = shuffle([blank.answer, ...shuffle(candidates, random).slice(0, 3)], random);
    const segments = words.flatMap((word, index) => [
      ...(index ? [{ text: ' ' }] : []),
      index + 1 === blank.index ? { text: '？', state: 'active', index: blank.index } : { text: word }
    ]);
    return { ...item, id: `${item.id}:phrase:${blank.index}`, sourceId: item.id, mode: 'phrase', term: item.japanese,
      blankIndex: blank.index, blankPosition: i + 1, blankTotal: blanks.length,
      answer: blank.answer, choices, correct: choices.indexOf(blank.answer), segments,
      prompt: segments.map(s => s.text).join(''), context: item.japanese,
      task: `「${item.japanese}」を表す熟語を完成させよう`,
      targetLabel: `強調された？に入る単語を回答（${i + 1} / ${blanks.length}）`,
      note: i + 1 === blanks.length ? item.note : '', reviewLabel: `${item.japanese} · 単語（${i + 1} / ${blanks.length}）` };
  });
}
export function makeEnglishQuestion(item, direction, random = Math.random) {
  if (!['to_japanese', 'to_english'].includes(direction)) throw new Error('Unknown English direction');
  const toJapanese = direction === 'to_japanese';
  const answer = toJapanese ? item.japanese : item.english;
  const dummies = toJapanese ? item.japanese_dummies : item.english_dummies;
  const candidates = [...new Set(dummies)].filter(value => value !== answer);
  if (candidates.length < 3) throw new Error(`${item.id}: insufficient translation choices`);
  const choices = shuffle([answer, ...shuffle(candidates, random).slice(0, 3)], random);
  return { ...item, id: `${item.id}:${direction}`, sourceId: item.id, mode: direction,
    term: item.english, answer, prompt: toJapanese ? item.english : item.japanese,
    task: toJapanese ? 'この英語の意味を選ぼう' : 'この意味にあてはまる英語を選ぼう', context: '',
    choices, correct: choices.indexOf(answer), reviewLabel: `${toJapanese ? item.english : item.japanese}` };
}
export function makeSpellingQuestions(item, random = Math.random) {
  for (const blank of item.spelling) {
    if (blank.dummies.some(value => Array.from(value).length !== Array.from(blank.answer).length)) {
      throw new Error(`${item.id}: spelling choices must have the same length`);
    }
  }
  return makeBlankQuestions({ ...item, term: item.japanese, term_dummies: [],
    explanation_template: item.spelling_template, blanks: item.spelling }, random).map(q => ({
      ...q, id: `${item.id}:spelling:${q.blankIndex}`, mode: 'spelling', continuation: q.blankPosition > 1, context: item.japanese,
      task: `「${item.japanese}」を表す英語の綴りを完成させよう`,
      targetLabel: `${q.blankPosition > 1 ? '次の' : '強調された'}？に入る${Array.from(q.answer).length}文字を回答（${q.blankPosition} / ${q.blankTotal}）`,
      note: q.blankPosition === q.blankTotal ? item.note : '',
      reviewLabel: `${item.japanese} · 綴り（${q.blankPosition} / ${q.blankTotal}）`
    }));
}
// Preserve source timestamps and keep every main beat, excluding subdivisions.
export function easyEvents(events) {
  const beats = new Set();
  return events.filter(event => {
    const key = `${event.bar}:${event.beatInBar}`;
    const main = event.beatPosition === 0 || (event.beatPosition === undefined && ['beat', 'accent', 'downbeat'].includes(event.type));
    if (!main || !Number.isInteger(event.beatInBar) || event.beatInBar < 1 || event.beatInBar > 4 || beats.has(key)) return false;
    beats.add(key); return true;
  });
}
export function trackPlaybackBounds(track, trim=true){
  const duration=track.durationSeconds;
  const start=trim?Math.max(0,Math.min(duration,Number(track.playback?.startSeconds)||0)):0;
  const end=trim?Math.max(start,Math.min(duration,Number(track.playback?.endSeconds)||duration)):duration;
  return end>start?{start,end,duration:end-start}:{start:0,end:duration,duration};
}
export function normalizeMusicSelection(value, availableIds) {
  const ids=Array.isArray(value)?value:typeof value==='string'&&value?[value]:[];
  const selected=[...new Set(ids.filter(id=>availableIds.includes(id)))];
  return selected.length?selected:null;
}
// Build enough music for one session. Random mode uses shuffled bags, avoiding
// immediate repeats across bags when multiple tracks are available.
export function sessionMusic(entries, selection='', random=Math.random, seconds=SESSION.durationSeconds, options={}) {
  const valid=entries.filter(e=>Number.isFinite(e.track.durationSeconds)&&e.track.durationSeconds>0);
  if(!valid.length)return makePlaylist([]);
  const ids=normalizeMusicSelection(selection,valid.map(e=>e.id));
  const pool=ids?valid.filter(e=>ids.includes(e.id)):valid, chosen=[];
  let duration=0;
  while(duration<seconds){
    const bag=[...pool];
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    if(bag.length>1&&chosen.at(-1)?.id===bag[0].id)[bag[0],bag[1]]=[bag[1],bag[0]];
    for(const entry of bag){chosen.push(entry);duration+=trackPlaybackBounds(entry.track,options.trim!==false).duration;if(duration>=seconds)break;}
  }
  return makePlaylist(chosen,options);
}
export function musicCredit(track) {
  return typeof track.creditText==='string'&&track.creditText.trim() ? track.creditText : `${track.title} / ${track.creator}`;
}

export function makePlaylist(entries,{trim=true}={}) {
  let duration = 0;
  const tracks = entries.map(({ id, track, chart }, occurrence) => {
    const start = duration;
    const bounds=trackPlaybackBounds(track,trim);
    duration += bounds.duration;
    return { id, ...track, start, durationSeconds:bounds.duration,mediaStart:bounds.start,mediaEnd:bounds.end,
      events: easyEvents(chart.events).map(event=>({...event,time:event.time+(track.timing.chartToAudioOffsetMs || 0)/1000}))
      .filter(event=>event.time>=bounds.start && event.time<bounds.end).map(event => ({
      ...event, time: start + event.time - bounds.start,
      bar: `${id}:${occurrence}:${event.bar}`
    })) };
  });
  return { tracks, duration, events: tracks.flatMap(track => track.events) };
}
export function answerProgress(count, required) {
  if (!Number.isFinite(required) || required <= 0 || !Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(1, count / required));
}
export function revealPlan(question,speed='slow') {
  const continuation = !!question.continuation;
  let cursor = 0.2;
  const segment = text => {
    const start = cursor;
    cursor += Math.max(0, Array.from(text).length - 1) * RULES.charSeconds + RULES.fadeSeconds;
    return { start, end: cursor };
  };
  const context = !continuation && question.context ? segment(question.task || question.context) : { start: 0, end: 0 };
  if (!continuation && question.context) cursor += RULES.choiceGapSeconds;
  const prompt = continuation ? { start: 0, end: 0 } : segment(question.prompt);
  const choices = question.choices.map(text => { cursor += RULES.choiceGapSeconds; return segment(text); });
  const liftStart = cursor + RULES.readHoldSeconds;
  const slowDuration=liftStart+(continuation?0:RULES.liftSeconds);
  const base={continuation,context,prompt,choices,revealEnd:cursor,liftStart,duration:slowDuration,
    charSeconds:RULES.charSeconds,fadeSeconds:RULES.fadeSeconds,liftSeconds:RULES.liftSeconds,instant:false};
  if(speed==='slow'||!Object.hasOwn(SPEEDS,speed))return base;
  const characters=Array.from((question.task||'')+question.prompt+question.choices.join('')).length;
  const fastDuration=Math.max(continuation?0:.35,characters/12);
  if(speed==='normal'){
    const lift=continuation?0:.5,duration=(slowDuration+fastDuration)/2;
    const factor=(duration-lift)/(slowDuration-(continuation?0:RULES.liftSeconds));
    const scaled=segment=>({start:segment.start*factor,end:segment.end*factor});
    return {...base,context:scaled(context),prompt:scaled(prompt),choices:choices.map(scaled),revealEnd:cursor*factor,
      liftStart:duration-lift,duration,charSeconds:RULES.charSeconds*factor,fadeSeconds:RULES.fadeSeconds*factor,liftSeconds:.5};
  }
  const duration=speed==='fast'?fastDuration:Math.max(continuation?0:.35,characters/20),lift=continuation?0:.35;
  return {...base,context:{start:0,end:0},prompt:{start:0,end:0},choices:choices.map(()=>({start:0,end:0})),
    revealEnd:0,liftStart:duration-lift,duration,charSeconds:0,fadeSeconds:0,liftSeconds:.35,instant:true};
}
export class Game {
  constructor(questions, events, offsetSeconds = 0, random = Math.random, endTime = Infinity, acceptQuestion = () => true, pickUnit = null, questionEndTime = Infinity, tapGoal = null, options = {}) {
    this.options=normalizeGameplayOptions(options);this.random=random;
    this.pickUnit = pickUnit;
    this.questions = pickUnit ? pickUnit() : makeQuestionQueue(questions, random, acceptQuestion);
    this.endTime = endTime; this.questionEndTime = questionEndTime;
    this.tapGoal=Number.isInteger(tapGoal) && tapGoal>0 && Number.isFinite(endTime)?tapGoal:null;
    let lanes = [];
    this.events = easyEvents(events).map((event, i) => {
      if (!lanes.length) lanes = shuffle([0, 1, 2, 3], random);
      return { target: event.time + offsetSeconds, id: i, lane: lanes.pop(), answerEligible:this.options.rhythm!=='hard'||[0,2].includes(i%4) };
    });
    if(this.tapGoal){
      const main=this.events,extra=[];
      for(let i=0;i<main.length-1;i++){
        const left=main[i],right=main[i+1],gap=right.target-left.target;
        if(gap<SESSION.minWhiteInterval*2 || gap>1.5)continue;
        const choices=[0,1,2,3].filter(lane=>lane!==left.lane && lane!==right.lane);
        extra.push({target:(left.target+right.target)/2,id:`half:${left.id}`,lane:choices[Math.floor(random()*choices.length)],half:true,answerEligible:this.options.rhythm==='hard'&&[0,1,3].includes(i%4)});
      }
      this.events=[...main,...extra].sort((a,b)=>a.target-b.target);
    }
    this.reveal = revealPlan(this.questions[0],this.options.speed);
    this.phase = 'intro'; this.phaseStart = 0; this.cursor = 0; this.notes = []; this.questionIndex = 0;
    this.rhythmScore = 0; this.rhythmBaseScore = 0; this.rhythmComboScore = 0; this.quizScore = 0; this.combo = 0; this.maxCombo = 0;
    this.quizCombo = 0; this.maxQuizCombo = 0; this.correctCount = 0; this.firstCount = 0;
    this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = '白いノーツが来たレーンを、音楽に合わせてタップ';
    this.judgments = { PERFECT: 0, GOOD: 0, MISS: 0 }; this.wrongCount = 0;
    this.missedNotes=0;this.emptyMisses=0;this.whiteJudgments=0;this.colorJudgments=0;
    this.whiteComboBonus=0;this.colorComboBonus=0;this.answerComboBonus=0;
    this.whiteUnits=0;this.colorUnits=0;this.answerUnits=0;this.colorRowsUsed=0;this.stageWrongCount=0;
    this.colorEligibleJudgments=0;this.startedQuestions=new Set();this.colorCapacityStarted=0;this.scorePlan=null;
    this.quizResult = null;
    this.lastJudgment = ''; this.judgmentTime = -10; this.time = 0;
    if(this.tapGoal)this.planWhites(0,Math.min(RULES.introSeconds,this.endTime));
  }
  get requiredTaps() {
    const value = this.question.tapsToAnswer;
    return Number.isInteger(value) && value > 0 ? value : RULES.tapsToAnswer;
  }
  get successfulTaps() { return this.judgments.PERFECT+this.judgments.GOOD; }
  get countedTaps(){return this.successfulTaps+this.missedNotes;}
  // The UI supplies an ideal-run reference; standalone callers keep legacy scoring.
  get scoreBreakdown(){
    if(!this.scorePlan)return null;
    const whiteDen=Math.max(1,this.scorePlan.white,this.whiteJudgments);
    const colorDen=Math.max(1,this.scorePlan.color,this.colorCapacityStarted);
    const answerDen=Math.max(1,this.scorePlan.questions,this.startedQuestions.size);
    const white=Math.floor(SCORE.white*Math.min(1,this.whiteUnits/whiteDen)+1e-8);
    const color=Math.floor(SCORE.color*Math.min(1,this.colorUnits/colorDen)+1e-8);
    const answer=Math.floor(SCORE.answer*Math.min(1,this.answerUnits/answerDen)+1e-8);
    const rhythm=Math.floor((white+color)*this.countedTaps/Math.max(1,this.countedTaps+this.emptyMisses)+1e-8);
    const netWhite=Math.floor(white*this.countedTaps/Math.max(1,this.countedTaps+this.emptyMisses)+1e-8);
    const netColor=rhythm-netWhite;
    const whiteBonus=this.whiteComboBonus,colorBonus=this.colorComboBonus,answerBonus=this.answerComboBonus;
    return {white,color,netWhite,netColor,baseAnswer:answer,answer:answer+answerBonus,whiteBonus,colorBonus,answerBonus,
      penalty:white+color-rhythm,rhythm:rhythm+whiteBonus+colorBonus,total:rhythm+whiteBonus+colorBonus+answer+answerBonus};
  }
  refreshScore(){
    const s=this.scoreBreakdown;if(!s)return;
    this.rhythmScore=s.rhythm;this.rhythmBaseScore=s.white+s.color;this.rhythmComboScore=s.whiteBonus+s.colorBonus;this.quizScore=s.answer;
  }
  resolveNote(note,label){
    const quality=label==='PERFECT'?1:label==='GOOD' ? .5 : 0;
    if(label==='MISS')this.missedNotes++;
    if(note.color===null){this.whiteJudgments++;this.whiteUnits+=quality;}
    else{
      this.colorJudgments++;
      if(this.colorRowsUsed<this.requiredTaps){this.colorUnits+=quality;this.colorEligibleJudgments++;}
      this.colorRowsUsed++;
    }
    this.refreshScore();
  }
  pendingWhites() { return this.notes.filter(n=>!n.done && n.color===null).length; }
  whiteSlots(now,end=this.endTime){
    return this.events.slice(this.cursor).filter(e=>e.target+1e-9>=now+RULES.travelSeconds && e.target+RULES.judgmentOffsetSeconds+RULES.goodWindow+RULES.judgmentSeconds<=end+1e-9);
  }
  unitTaps(){
    let taps=0;
    for(let step=0;step<this.questions.length;step++){
      const q=this.questions[(this.questionIndex+step)%this.questions.length];
      if(step && !(q.continuation && q.sourceId===this.question.sourceId && q.mode===this.question.mode))break;
      taps+=Number.isInteger(q.tapsToAnswer) && q.tapsToAnswer>0?q.tapsToAnswer:RULES.tapsToAnswer;
    }
    return taps;
  }
  planWhites(now,end){
    this.whitePhaseEnd=end;
    const remaining=Math.max(0,this.tapGoal-this.countedTaps-this.pendingWhites());
    const desired=this.phase==='outro'?this.tapGoal:Math.round(this.tapGoal*Math.min(end,this.endTime)/this.endTime);
    const needed=Math.min(remaining,Math.max(this.phase==='outro'?0:1,desired-this.countedTaps-this.pendingWhites()));
    const slots=this.whiteSlots(now,end),main=slots.filter(e=>!e.half),pool=main.length>=needed?main:slots;
    const count=Math.min(needed,pool.length);
    this.whiteTargets=new Set(Array.from({length:count},(_,i)=>pool[Math.floor((i+1)*pool.length/count)-1].id));
  }
  get totalScore() { return this.rhythmScore + this.quizScore; }
  get laneCount() { return RULES.lanes; }
  get question() { return this.questions[this.questionIndex % this.questions.length]; }
  answerEvent(event){return this.options.rhythm==='hard'?!!event.answerEligible:!event.half;}
  earliestCompletion(now) {
    let time = now, cursor = 0;
    const events=this.events.slice(this.cursor).filter(e=>this.answerEvent(e));
    for (let step = 0; step < this.questions.length; step++) {
      const q = this.questions[(this.questionIndex + step) % this.questions.length];
      if (step && !(q.continuation && q.sourceId === this.question.sourceId && q.mode === this.question.mode)) break;
      const ready = time + revealPlan(q,this.options.speed).duration + RULES.travelSeconds;
      const taps = Number.isInteger(q.tapsToAnswer) && q.tapsToAnswer > 0 ? q.tapsToAnswer : RULES.tapsToAnswer;
      while (cursor < events.length && events[cursor].target < ready) cursor++;
      const last = events[cursor + taps - 1];
      if (!last) return Infinity;
      time = last.target + RULES.feedbackSeconds;
      cursor += taps;
    }
    return time;
  }
  changePhase(phase, now) {
    if (phase === 'read' && this.pickUnit && this.questionIndex >= this.questions.length) this.questions.push(...this.pickUnit());
    if (phase === 'read' && !this.question.continuation && Number.isFinite(this.endTime)){
      const completion=this.earliestCompletion(now),taps=this.unitTaps();
      if(completion+.25>Math.min(this.endTime,this.questionEndTime) || this.tapGoal &&
        (this.countedTaps+taps>this.tapGoal || this.whiteSlots(completion).length<this.tapGoal-this.countedTaps-taps))phase='outro';
    }
    this.phase = phase; this.phaseStart = now;
    if (phase === 'outro') { this.quizResult = null; this.message = ''; this.counts = [0, 0, 0, 0]; }
    if (phase === 'read') {
      this.colorRowsUsed=0;this.stageWrongCount=0;
      if(!this.startedQuestions.has(this.questionIndex)){this.startedQuestions.add(this.questionIndex);this.colorCapacityStarted+=this.requiredTaps;}
      this.refreshScore();this.reveal = revealPlan(this.question,this.options.speed); this.counts = [0, 0, 0, 0]; this.firstTry = true; this.message = ''; this.quizResult = null; }
    if (phase === 'rhythm') {
      this.quizResult = null; this.message = '';
      const targets = this.events.slice(this.cursor).filter(e => !e.half && e.target >= now + RULES.travelSeconds).slice(0, RULES.rhythmNotes);
      this.rhythmTargets = new Set(targets.map(e => e.id));
      this.rhythmEnd = (targets.at(-1)?.target ?? now) + RULES.judgmentOffsetSeconds + RULES.goodWindow + RULES.judgmentSeconds;
    }
    if(this.tapGoal && ['intro','rhythm','outro'].includes(phase)){
      const end=phase==='intro'?Math.min(RULES.introSeconds,this.endTime):phase==='outro'?this.endTime:Math.min(this.rhythmEnd,this.endTime);
      this.planWhites(now,end);
      if(phase==='rhythm' && this.whiteSlots(end).length<this.tapGoal-this.countedTaps-this.pendingWhites()-this.whiteTargets.size){this.changePhase('outro',now);return;}
    }
    if (phase === 'answer') this.message = `答えの色を${this.requiredTaps}回タップ`;
  }
  update(now) {
    this.time = now;
    if (this.phase === 'ended') return;
    if (this.phase === 'read' && now - this.phaseStart + 1e-9 >= this.reveal.duration) this.changePhase('answer', now);
    while (this.cursor < this.events.length && this.events[this.cursor].target <= now + RULES.travelSeconds) {
      const event = this.events[this.cursor++];
      if (!['intro', 'answer', 'rhythm', 'outro'].includes(this.phase)) continue;
      if(this.phase==='answer' && !this.answerEvent(event))continue;
      if(this.tapGoal && this.phase!=='answer'){
        if(!this.whiteTargets.has(event.id) || this.countedTaps+this.pendingWhites()>=this.tapGoal)continue;
      }else if (this.phase === 'rhythm' && !this.rhythmTargets.has(event.id)) continue;
      if (event.target < this.phaseStart + RULES.travelSeconds) continue;
      // Do not launch a note that cannot be judged and displayed before the intro ends.
      if (this.phase === 'intro' && event.target + RULES.judgmentOffsetSeconds + RULES.goodWindow + RULES.judgmentSeconds > RULES.introSeconds) continue;
      if (event.target + RULES.judgmentOffsetSeconds + RULES.goodWindow + RULES.judgmentSeconds > this.endTime) continue;
      if (this.phase === 'answer') {
        COLORS.forEach((_,color)=>this.notes.push({...event,rowId:event.id,lane:color,color,done:false}));
      } else this.notes.push({ ...event, color: null, done: false });
    }
    for (const note of this.notes) {
      if (!note.done && timingError(note.target, now) > RULES.goodWindow + 1e-9) {
        note.done = true;
        // An unanswered four-color row is one miss; unchosen siblings are not misses.
        if (note.rowId !== undefined) {
          for (const sibling of this.notes) if (sibling.rowId === note.rowId) sibling.done = true;
        }
        this.combo = 0; this.judge('MISS', now);this.resolveNote(note,'MISS');
      }
    }
    this.notes = this.notes.filter(note => !note.done);
    const settled = !this.notes.length && now - this.judgmentTime >= RULES.judgmentSeconds;
    if (this.phase === 'intro' && now >= RULES.introSeconds && settled) this.changePhase('read', now);
    else if (this.phase === 'feedback' && now - this.phaseStart >= RULES.feedbackSeconds && settled) {
      const next = this.questions[(this.questionIndex + 1) % this.questions.length];
      if (next.sourceId === this.question.sourceId && next.mode === this.question.mode && next.continuation) {
        this.questionIndex++; this.changePhase('read', now);
      } else if (this.events.slice(this.cursor).some(e => e.target >= now + RULES.travelSeconds)) this.changePhase('rhythm', now);
      else { this.questionIndex++; this.changePhase('read', now); }
    } else if (this.phase === 'rhythm' && now >= this.rhythmEnd && settled) {
      this.questionIndex++; this.changePhase('read', now);
    }
  }
  judge(label, now) { this.judgments[label]++; this.lastJudgment = label; this.judgmentTime = now; }
  tap(lane, now) {
    if (this.phase === 'ended') return null;
    this.update(now);
    if (this.phase === 'read' || this.phase === 'feedback') return null;
    const note = this.notes.filter(n => !n.done && n.lane === lane && Math.abs(timingError(n.target, now)) <= RULES.goodWindow + 1e-9)
      .sort((a, b) => Math.abs(timingError(a.target, now)) - Math.abs(timingError(b.target, now)))[0];
    if (!note) { this.combo = 0; this.judge('MISS', now);this.emptyMisses++;this.refreshScore();return null; }
    note.done = true;
    if (note.rowId !== undefined) {
      for (const sibling of this.notes) if (sibling.rowId === note.rowId) sibling.done = true;
    }
    const perfect = Math.abs(timingError(note.target, now)) <= RULES.perfectWindow + 1e-9;
    this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    const colored = this.phase === 'answer' && note.color !== null;
    const base = perfect ? (colored ? 2 : 10) : (colored ? 1 : 5);
    const bonus = colored ? 0 : this.combo;
    if(!this.scorePlan){this.rhythmBaseScore += base; this.rhythmComboScore += bonus;this.rhythmScore += base + bonus;}
    if(this.scorePlan){
      if(note.color===null)this.whiteComboBonus+=this.combo;
      else if(this.colorRowsUsed<this.requiredTaps)this.colorComboBonus+=this.combo;
    }
    this.judge(perfect ? 'PERFECT' : 'GOOD', now);this.resolveNote(note,perfect?'PERFECT':'GOOD');
    if (this.phase === 'answer' && note.color !== null) {
      this.counts[note.color]++;
      if (this.counts[note.color] >= this.requiredTaps) {
        if (note.color === this.question.correct) {
          this.quizResult = { correct: true, time: now, choice: note.color };
          this.correctCount++;
          if (this.firstTry) { this.firstCount++; this.maxQuizCombo = Math.max(this.maxQuizCombo, ++this.quizCombo); }
          if(this.scorePlan){
            this.answerUnits+=SCORE.answerRates[Math.min(this.stageWrongCount,3)];
            if(this.firstTry)this.answerComboBonus+=this.quizCombo*10;
            this.refreshScore();
          }else{this.quizScore+=50+(this.firstTry?this.quizCombo*10:0);}
          this.message = this.firstTry ? '一発正解！' : '正解！';
          this.notes = [];
          this.changePhase('feedback', now);
        } else {
          this.quizResult = { correct: false, time: now, choice: note.color };
          this.wrongCount++;this.stageWrongCount++;
          this.firstTry = false; this.quizCombo = 0; this.combo = 0; this.counts = [0, 0, 0, 0];
          this.message = `もう一度！ 正解だと思う色を${this.requiredTaps}回タップ`;
        }
      }
    }
    return note;
  }
  achievements(completed, unfinished = false) {
    const { PERFECT, GOOD, MISS } = this.judgments;
    const rhythm = completed && PERFECT + GOOD > 0 && MISS === 0 && this.wrongCount === 0;
    const quiz = completed && !unfinished && this.correctCount > 0 && this.wrongCount === 0;
    return { rhythm, quiz, double: rhythm && quiz, allPerfect: rhythm && GOOD === 0 };
  }
  finish() { this.phase = 'ended'; this.notes = []; }
}
