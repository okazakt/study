import { Game, RULES, COLORS, answerProgress, makePlaylist } from './game.js?v=0.19.0';
import { buildCatalog, normalizePreferences, selectQuestions, practiceTypes, matchesPracticeItem, matchesPracticeQuestion, sectionKey } from './learning.js?v=0.19.0';
const VERSION = '0.19.0';
const $ = id => document.getElementById(id);
const audio = $('audio');
let questions, playlist, track, trackIndex = 0, game, frame, busy = false, history = [], screen = 'home';
let questionKey = '';
let characters = [], choiceElements = [];
let catalog, preferences, activeSubject = '', dataReady = false, savedLearning;
try { savedLearning = JSON.parse(localStorage.getItem('study-beat-learning-v1') || 'null'); } catch { /* Use the first-run school selector. */ }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
try { $('offset').value = localStorage.getItem('study-beat-offset-ms') || '0'; } catch { /* Private browsing may disable storage. */ }
$('offset').addEventListener('change', () => {
  $('offset').value = Math.max(-500, Math.min(500, Number($('offset').value) || 0));
  try { localStorage.setItem('study-beat-offset-ms', $('offset').value); } catch { /* Play remains available. */ }
});
// A short, quiet synthesized woodblock; independent of the song clock.
let tapAudio, tapSoundEnabled = true;
try { tapSoundEnabled = localStorage.getItem('study-beat-tap-sound') !== 'off'; } catch {}
for (const id of ['tap-sound', 'help-tap-sound']) {
  $(id).checked = tapSoundEnabled;
  $(id).addEventListener('change', () => {
    tapSoundEnabled = $(id).checked;
    for (const other of ['tap-sound', 'help-tap-sound']) $(other).checked = tapSoundEnabled;
    try { localStorage.setItem('study-beat-tap-sound', tapSoundEnabled ? 'on' : 'off'); } catch {}
    if (tapSoundEnabled) prepareTapAudio();
  });
}
function prepareTapAudio() {
  if (!tapSoundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    tapAudio ||= new Context({ latencyHint: 'interactive' });
    if (tapAudio.state === 'suspended') tapAudio.resume().catch(() => {});
  } catch { /* Sound is optional. */ }
}
function playTapSound() {
  prepareTapAudio();
  if (!tapSoundEnabled || tapAudio?.state !== 'running') return;
  try {
    const t = tapAudio.currentTime, oscillator = tapAudio.createOscillator(), gain = tapAudio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(720, t);
    oscillator.frequency.exponentialRampToValueAtTime(230, t + .045);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.055, t + .002);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .055);
    oscillator.connect(gain); gain.connect(tapAudio.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(t); oscillator.stop(t + .06);
  } catch { /* Sound must never interrupt scoring. */ }
}
const show = next => { screen = next; document.body.classList.toggle('playing', next === 'play'); for (const name of ['home', 'play', 'result']) $(name).hidden = name !== next; if (next === 'home') checkForUpdate(); };
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
async function json(path) { const r = await fetch(`${path}?v=${VERSION}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
const selection = () => preferences?.profiles[preferences.school];
const selectedQuestions = () => dataReady ? selectQuestions(questions, preferences.school, selection(), catalog) : [];
function saveLearning() {
  try { localStorage.setItem('study-beat-learning-v1', JSON.stringify(preferences)); }
  catch { $('learning-storage-note').hidden = false; }
}
function refreshStart() {
  const count = selectedQuestions().length;
  $('start').disabled = busy || !count;
  $('start').textContent = count ? 'プレイをはじめる →' : !preferences?.school ? '学校を選んでください' : selection() ? '単元を選んでください' : '学ぶ範囲を選んでください';
}
function setSchool(school) {
  if (!dataReady) return;
  preferences.school = school;
  activeSubject = catalog.find(course => course.id === selection()?.id)?.subject || '';
  saveLearning(); renderLearning();
}
function renderLearning() {
  const school = preferences.school;
  $('school-onboarding').hidden = !!school; $('study-menu').hidden = !school;
  if (!school) { refreshStart(); return; }
  $('school-label').textContent = school; $('school-setting').value = school;
  const courses = catalog.filter(course => course.school === school);
  const subjects = [...new Set(courses.map(course => course.subject))];
  if (!subjects.includes(activeSubject)) activeSubject = courses.find(course => course.count)?.subject || subjects[0];
  $('subject-list').replaceChildren();
  for (const subject of subjects) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = subject;
    button.setAttribute('aria-pressed', String(subject === activeSubject));
    button.addEventListener('click', () => {
      if (activeSubject !== subject) { activeSubject = subject; preferences.profiles[school] = null; saveLearning(); }
      renderLearning();
    });
    $('subject-list').append(button);
  }
  $('course-list').replaceChildren();
  for (const course of courses.filter(course => course.subject === activeSubject)) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.course = course.id;
    button.disabled = !course.count; button.setAttribute('aria-pressed', String(course.id === selection()?.id));
    const title = document.createElement('strong'); title.textContent = course.label;
    const detail = document.createElement('span'); detail.textContent = course.count ? `${course.count}件${course.year === 'exam' ? ` · 収録 ${course.grades.join('・')}` : ''}` : '準備中';
    button.append(title, detail);
    button.addEventListener('click', () => {
      if (selection()?.id !== course.id) { preferences.profiles[school] = { id: course.id, sections: null, practiceType: selection()?.practiceType || 'all' }; saveLearning(); }
      renderLearning();
    });
    $('course-list').append(button);
  }
  const entry = selection(), course = courses.find(course => course.id === entry?.id);
  $('selected-course').hidden = !course;
  const count = selectedQuestions().length;
  if (course) {
    $('selected-course-title').textContent = `${course.label}を出題`;
    const practiceItems = questions.filter(item => course.ids.includes(item.id) && matchesPracticeItem(item,entry.practiceType || 'all'));
    const fields = [...new Set(practiceItems.map(item => item.field))], grades = [...new Set(practiceItems.map(item => item.grade))];
    $('course-coverage').textContent = `現在の収録：${grades.join('・')}／${fields.join('・')} · ${practiceItems.length}項目${course.year === 'exam' ? '（未収録の学年・分野は含みません）' : ''}`;
    const options = practiceTypes(course.subject);
    $('practice-picker').hidden = options.length === 1;
    $('practice-list').replaceChildren();
    for (const option of options) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.practice = option.id; button.textContent = option.label;
      button.setAttribute('aria-pressed', String(option.id === (entry.practiceType || 'all')));
      button.addEventListener('click', () => {
        if (entry.practiceType !== option.id) { entry.practiceType = option.id; entry.sections = null; saveLearning(); }
        renderLearning();
      });
      $('practice-list').append(button);
    }
    const allowedSections = new Set(practiceItems.map(sectionKey));
    const availableSections = course.sections.filter(section => allowedSections.has(section.key));
    const selected = entry.sections === null ? availableSections.map(section => section.key) : entry.sections.filter(key => allowedSections.has(key));
    $('section-summary').textContent = selected.length === availableSections.length ? '（すべて）' : `（${selected.length} / ${availableSections.length}）`;
    $('all-sections').checked = selected.length === availableSections.length;
    $('all-sections').indeterminate = selected.length > 0 && selected.length < availableSections.length;
    $('section-list').replaceChildren();
    for (const section of availableSections) {
      const label = document.createElement('label'); label.className = 'section-option';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected.includes(section.key); input.dataset.section = section.key;
      input.addEventListener('change', () => {
        const keys = new Set(entry.sections === null ? availableSections.map(part => part.key) : selected);
        input.checked ? keys.add(section.key) : keys.delete(section.key);
        entry.sections = keys.size === availableSections.length ? null : [...keys]; saveLearning(); renderLearning();
      });
      const text = document.createElement('span'); text.textContent = `${section.label}（${section.count}件）`;
      label.append(input, text); $('section-list').append(label);
    }
  }
  $('selection-status').textContent = course ? count ? `選択範囲：${count}項目から出題します。` : '単元を1つ以上選んでください。'
    : !courses.some(course => course.count) ? `${school}の問題は準備中です。設定から学校を変更できます。`
    : courses.some(course => course.subject === activeSubject && course.count) ? '学年または受験用を選んでください。' : `${activeSubject}の問題は準備中です。ほかの教科を選んでください。`;
  refreshStart();
}
$('all-sections').addEventListener('change', () => { selection().sections = $('all-sections').checked ? null : []; saveLearning(); renderLearning(); });
document.querySelectorAll('[data-school]').forEach(button => button.addEventListener('click', () => setSchool(button.dataset.school)));
$('open-learning-settings').addEventListener('click', () => $('learning-settings').showModal());
$('close-learning-settings').addEventListener('click', () => $('learning-settings').close());
$('school-setting').addEventListener('change', () => setSchool($('school-setting').value));
const playbackTime = () => track.start + audio.currentTime;
function selectTrack(index) {
  trackIndex = index; track = playlist.tracks[index];
  audio.src = `./music-data/${track.files.audio}`;
  $('track-title').textContent = track.title;
  $('track-credit').textContent = `${index + 1} / ${playlist.tracks.length} · ${track.creator}`;
}
async function load() {
  try {
    const [index, quiz, english, japanese] = await Promise.all([json('./music-data/index.json'), json('./quiz-data/junior_science.json'), json('./quiz-data/junior_english.json'), json('./quiz-data/junior_japanese.json')]);
    questions = [...quiz, ...english, ...japanese];
    const entries = await Promise.all(['0001', '0002'].map(async id => ({ id, track: index[id], chart: await json(`./music-data/${index[id].files.chart}`) })));
    playlist = makePlaylist(entries);
    if (!questions.length || !playlist.events.length) throw new Error('データが空です');
    selectTrack(0);
    catalog = buildCatalog(questions); preferences = normalizePreferences(savedLearning, catalog);
    activeSubject = catalog.find(course => course.id === selection()?.id)?.subject || '';
    dataReady = true; document.querySelectorAll('[data-school]').forEach(button => { button.disabled = false; });
    renderLearning();
  } catch (error) { $('load-status').textContent = `データの読み込みに失敗しました。ページを再読み込みしてください。 (${error.message})`; }
}
async function start() {
  if (busy) return;
  const filtered = selectedQuestions(); if (!filtered.length) { refreshStart(); return; }
  prepareTapAudio();
  busy = true; $('start').disabled = true;
  cancelAnimationFrame(frame); audio.pause(); selectTrack(0); audio.currentTime = 0;
  const offsetMs = Number($('offset').value) || 0;
  const practiceType = selection()?.practiceType || 'all';
  game = new Game(filtered, playlist.events, offsetMs / 1000, Math.random, playlist.duration, question => matchesPracticeQuestion(question,practiceType));
  history = []; questionKey = ''; show('play'); render(); draw(); $('pause').disabled = true;
  try { await audio.play(); $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop(); }
  catch { show('home'); $('load-status').textContent = '音声を再生できませんでした。接続を確認して、もう一度開始してください。'; }
  finally { busy = false; refreshStart(); $('pause').disabled = false; }
}
function appendCharacters(element, text, start, segments = [{ text }]) {
  element.replaceChildren(); element.setAttribute('aria-label', text);
  let index = 0;
  for (const segment of segments) {
    const group = document.createElement('span');
    if (segment.state) {
      group.className = `blank-${segment.state}`; group.dataset.blankIndex = segment.index;
      characters.push({ element: group, start: start + index * RULES.charSeconds });
    }
    element.append(group);
    for (const character of Array.from(segment.text)) {
      const span = document.createElement('span'); span.className = 'reveal-char';
      span.textContent = character; span.setAttribute('aria-hidden', 'true'); group.append(span);
      characters.push({ element: span, start: start + index++ * RULES.charSeconds });
    }
  }
}
function renderQuestion() {
  const intro = ['intro', 'rhythm', 'outro'].includes(game.phase);
  const key = `${intro ? game.phase : 'question'}:${game.questionIndex}:${game.phase === 'feedback'}`;
  if (key === questionKey) return;
  questionKey = key; $('question-panel').scrollTop = 0; characters = []; choiceElements = []; $('choices').replaceChildren();
  const q = game.question;
  const segments = q.segments?.map(segment => game.phase === 'feedback' && segment.state === 'active' ? { ...segment, text: q.answer, state: 'solved' } : segment);
  const prompt = intro ? (game.phase === 'outro' ? '最後までリズムをつなごう' : game.phase === 'rhythm' ? 'リズムにのって、次の問題へ' : 'まずはリズムにのろう') : segments ? segments.map(s => s.text).join('') : q.prompt;
  appendCharacters($('prompt'), prompt, game.reveal.prompt.start, intro ? undefined : segments);
  $('question-task').textContent = intro || q.context ? '' : q.task;
  appendCharacters($('question-context'), intro || !q.context ? '' : q.task, game.reveal.context.start);
  $('blank-instruction').hidden = intro || !q.blankIndex;
  $('blank-instruction').textContent = game.phase === 'feedback' ? `正解：${q.answer}` : q.targetLabel || '';
  const diagram = !intro && q.diagram;
  $('kanji-puzzle').hidden = !diagram;
  $('question-panel').classList.toggle('has-kanji', !!diagram);
  const completed = !!diagram && game.phase === 'feedback' && q.blankPosition === q.blankTotal;
  $('kanji-puzzle').classList.toggle('completed', completed);
  if (diagram) {
    $('kanji-puzzle').replaceChildren();
    if (completed) $('kanji-puzzle').textContent = q.character;
    else for (const part of diagram.parts) {
      const solved = part.state === 'solved' || (part.state === 'active' && game.phase === 'feedback');
      const piece = document.createElement('span'); piece.className = `kanji-piece ${solved ? 'solved' : part.state}`;
      piece.dataset.position = part.position;
      const [x,y,width,height] = part.box;
      Object.assign(piece.style, {left:`calc(${x}% + 2px)`,top:`calc(${y}% + 2px)`,width:`calc(${width}% - 4px)`,height:`calc(${height}% - 4px)`});
      const glyph = document.createElement('span'); glyph.textContent = solved ? part.answer : '？';
      if (solved) { const size = height * 0.80 * 0.88; glyph.style.fontSize = `${size}px`; glyph.style.transform = `scaleX(${Math.min(1,width*0.88/size)})`; }
      piece.append(glyph); $('kanji-puzzle').append(piece);
    }
    $('kanji-puzzle').setAttribute('aria-label', completed ? `完成：${q.character}` : `${q.targetLabel}。${diagram.parts.filter(part => part.state === 'solved').map(part => `${part.position}は${part.answer}`).join('、')}`);
  }
  if (!intro) q.choices.forEach((choice, i) => {
    const el = document.createElement('div'); el.className = 'choice'; el.style.setProperty('--color', COLORS[i].value);
    el.classList.toggle('is-glyph', q.mode === 'kanji_component');
    const text = document.createElement('span'); appendCharacters(text, choice, game.reveal.choices[i].start); el.append(text);
    el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', choice);
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    choiceElements.push({ element: el, start: game.reveal.choices[i].start }); $('choices').append(el);
  });
}
function positionQuestion(elapsed) {
  const panel = $('question-panel');
  panel.style.maxHeight = `${Math.max(100, $('play-stage').clientHeight - 112)}px`;
  // Reserve the final position, then place the same panel above the touch line.
  $('question-slot').style.height = `${panel.offsetHeight}px`;
  const stage = $('play-stage').getBoundingClientRect(), field = $('field').getBoundingClientRect();
  const lower = Math.max(0, field.bottom - stage.top - 72 - panel.offsetHeight);
  const progress = Math.max(0, Math.min(1, (elapsed - game.reveal.liftStart) / RULES.liftSeconds));
  const ease = progress * progress * (3 - 2 * progress);
  const lift = reducedMotion.matches ? (progress === 1 ? 1 : 0) : ease;
  panel.style.transform = `translate3d(0,${game.phase === 'read' && !game.reveal.continuation ? lower * (1 - lift) : 0}px,0)`;
}
function render() {
  $('total-score').textContent = game.totalScore.toLocaleString(); $('rhythm-combo').textContent = game.combo;
  $('quiz-combo').textContent = game.quizCombo;
  $('time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || track.durationSeconds)}`;
  renderQuestion();
  const q = game.question, elapsed = game.time - game.phaseStart;
  $('play').dataset.phase = game.phase;
  $('play').dataset.continuation = game.reveal.continuation;
  $('field').setAttribute('aria-label', game.phase === 'answer' ? '4色の回答エリア' : '白ノーツのタップエリア');
  document.querySelectorAll('[data-lane]').forEach(button => { button.hidden = Number(button.dataset.lane) >= game.laneCount; button.style.setProperty('--lane-color', game.phase === 'answer' ? COLORS[Number(button.dataset.lane)].value : '#dce7f5'); });
  document.querySelector('.lane-keys').style.gridTemplateColumns = `repeat(${game.laneCount},1fr)`;
  document.querySelector('.play-hint').textContent = game.phase === 'read' || game.phase === 'feedback' ? '' : game.phase === 'answer' ? `4色が横一列に到着。答えの色だけを${game.requiredTaps}回タップ。` : '白ノーツが流れてきたレーンをタップ。';
  $('question-number').textContent = ['intro', 'rhythm', 'outro'].includes(game.phase) ? '白ノーツのレーンをタップ' : `Q ${game.questionIndex + 1} · ${q.grade} ${q.subject} / ${q.field}`;
  $('instruction').textContent = game.message;
  for (const character of characters) {
    const opacity = game.phase === 'read' && !game.reveal.continuation ? Math.max(0, Math.min(1, (elapsed - character.start) / RULES.fadeSeconds)) : 1;
    character.element.style.opacity = reducedMotion.matches ? Number(opacity > 0) : opacity;
  }
  choiceElements.forEach(({element, start}, i) => {
    element.style.opacity = game.phase === 'read' && !game.reveal.continuation ? Math.max(0, Math.min(1, (elapsed - start) / RULES.fadeSeconds)) : 1;
    element.classList.toggle('correct', game.phase === 'feedback' && i === q.correct);
    const progress = answerProgress(game.counts[i], game.requiredTaps);
    const strength = 0.08 + progress * 0.72;
    element.style.setProperty('--choice-strength', `${strength * 100}%`);
    element.dataset.progress = progress;
    element.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    // Choose a readable foreground as each pastel background becomes stronger.
    const rgb = COLORS[i].value.match(/[a-f\d]{2}/gi).map(hex => parseInt(hex, 16));
    const channel = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    const luminance = values => values.map(value => channel(value / 255)).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const background = luminance(rgb.map((value, index) => value * strength + [20, 30, 48][index] * (1 - strength)));
    const dark = luminance([16, 26, 42]);
    const darkContrast = (background + 0.05) / (dark + 0.05), lightContrast = 1.05 / (background + 0.05);
    element.style.color = Math.max(darkContrast, lightContrast) < 4.5 ? '#000000' : darkContrast >= lightContrast ? '#101a2a' : '#ffffff';
  });
  $('explanation').textContent = game.phase === 'feedback'
    ? q.blankPosition < q.blankTotal ? `正解：${q.answer}` : `正解：${q.answer} · ${q.note}`
    : '';
  const result = game.quizResult;
  const resultVisible = result && (game.phase === 'feedback' || game.time - result.time < RULES.wrongResultSeconds);
  $('quiz-feedback').hidden = !resultVisible;
  if (resultVisible) {
    $('quiz-feedback').dataset.result = result.correct ? 'correct' : 'wrong';
    $('quiz-symbol').textContent = result.correct ? '⭕️' : '✖️';
    $('quiz-result-label').textContent = result.correct ? '正解！' : '不正解 · もう一度';
  }
  const judgmentVisible = game.lastJudgment && game.time - game.judgmentTime < RULES.judgmentSeconds;
  $('tap-judgment').hidden = !judgmentVisible;
  $('tap-judgment').textContent = game.lastJudgment;
  $('tap-judgment').dataset.judgment = game.lastJudgment;
  positionQuestion(elapsed);
  $('field').classList.toggle('compact-feedback', $('field').clientHeight < 190);
  const rhythmStreak = $('rhythm-streak');
  rhythmStreak.hidden = game.combo < 2;
  $('streak-count').textContent = game.combo;
  rhythmStreak.classList.toggle('milestone', game.combo > 0 && game.combo % 10 === 0);
  const rhythmPulse = reducedMotion.matches ? 0 : Math.max(0, 1 - (game.time - game.judgmentTime) / 0.35);
  rhythmStreak.style.setProperty('--pulse', rhythmPulse);
  const quizStreak = $('quiz-streak');
  quizStreak.hidden = game.quizCombo < 2;
  $('quiz-streak-count').textContent = game.quizCombo;
  $('streak-pair').hidden = game.combo < 2 && game.quizCombo < 2;
  $('streak-pair').classList.toggle('paired', game.combo >= 2 && game.quizCombo >= 2);
  const quizPulse = reducedMotion.matches || !result ? 0 : Math.max(0, 1 - (game.time - result.time) / 0.6);
  quizStreak.style.setProperty('--pulse', quizPulse);
}
const canvas = $('canvas'); const ctx = canvas.getContext('2d');
function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const laneWidth = width / game.laneCount, line = height - 40;
  for (let i = 0; i < game.laneCount; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff04' : '#00000008'; ctx.fillRect(i * laneWidth, 0, laneWidth, height);
    ctx.strokeStyle = '#ffffff12'; ctx.beginPath(); ctx.moveTo(i * laneWidth, 0); ctx.lineTo(i * laneWidth, height); ctx.stroke();
  }
  ctx.fillStyle = '#a8f07d10'; ctx.fillRect(0, line - 13, width, 26);
  ctx.strokeStyle = '#b8ed96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, line); ctx.lineTo(width, line); ctx.stroke();
  for (const note of game.notes) {
    if (note.done) continue;
    const noteHeight = Math.min(20, Math.max(10, line * 0.22));
    const y = line * (1 - (note.target - playbackTime()) / RULES.travelSeconds);
    const white = note.color === null;
    const x = note.lane * laneWidth + 8;
    const w = laneWidth - 16;
    ctx.fillStyle = white ? '#e5edf7' : COLORS[note.color].value;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(x, y - noteHeight / 2, w, noteHeight, 5); ctx.fill(); ctx.shadowBlur = 0;
  }

}
function loop() {
  if (!game || screen !== 'play') return;
  game.update(playbackTime()); render(); draw();
  if (!audio.paused) frame = requestAnimationFrame(loop);
}
function tap(lane) {
  if (screen !== 'play' || audio.paused || busy || lane >= game.laneCount) return;
  game.update(playbackTime());
  const q = game.question, first = game.firstTry, previousCount = game.correctCount;
  if (['intro', 'answer', 'rhythm', 'outro'].includes(game.phase)) playTapSound();
  game.tap(lane, playbackTime());
  if (game.correctCount > previousCount) history.push({ term:q.term, note:q.note, first, label:q.reviewLabel, answer:q.answer });
  render(); draw();
}
$('play-stage').addEventListener('pointerdown', event => {
  const bounds = canvas.getBoundingClientRect();
  if (event.clientY < bounds.top || event.clientY > bounds.bottom) return;
  event.preventDefault();
  tap(Math.max(0, Math.min(game.laneCount - 1, Math.floor((event.clientX - bounds.left) / bounds.width * game.laneCount))));
});
document.querySelectorAll('[data-lane]').forEach(button => button.addEventListener('pointerdown', event => { event.preventDefault(); tap(Number(button.dataset.lane)); }));
// Prevent selection handles, long-press callouts and drag gestures while playing.
for (const type of ['selectstart', 'contextmenu', 'dragstart']) $('play').addEventListener(type, event => event.preventDefault());
document.addEventListener('keydown', event => {
  if ($('controls-help').open || screen !== 'play' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const lane = ['KeyD','KeyF','KeyG','KeyH'].indexOf(event.code);
  if (lane >= 0) { event.preventDefault(); tap(lane); }
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
});
function pause() {
  if (screen !== 'play') return;
  audio.pause(); cancelAnimationFrame(frame); $('pause').textContent = '再開'; $('pause-overlay').hidden = false;
}
async function togglePause() {
  if (busy || screen !== 'play') return;
  if (!audio.paused) { pause(); return; }
  prepareTapAudio();
  busy = true;
  try { await audio.play(); $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop(); }
  catch { game.message = '再生できませんでした。再開を押して再試行してください。'; render(); }
  finally { busy = false; }
}
function finish(completed) {
  if (screen !== 'play') return;
  audio.pause(); cancelAnimationFrame(frame);
  if (completed) game.update(playbackTime());
  const unfinished = !['intro','feedback','rhythm','outro'].includes(game.phase) ? game.question.reviewLabel : null;
  const awards = game.achievements(completed, !!unfinished);
  game.finish(); show('result');
  $('result-awards').replaceChildren();
  const praise = [];
  if (awards.double) praise.push(['ダブルパーフェクト！', 'リズムも回答も、最後までミスなし。見事な完走！']);
  if (awards.rhythm) praise.push(['リズム フルコンボ！', awards.allPerfect ? 'ALL PERFECT · 全タップが最高判定！' : 'ノーミスでビートをつなぎ切った！']);
  if (awards.quiz) praise.push(['全問一発正解！', 'お手付きゼロ。知識も集中力もばっちり！']);
  $('result-awards').hidden = !praise.length;
  $('result-awards').classList.toggle('double-perfect', awards.double);
  for (const [title, detail] of praise) {
    const card = document.createElement('div'), heading = document.createElement('h2'), text = document.createElement('p');
    heading.textContent = title; text.textContent = detail; card.append(heading, text); $('result-awards').append(card);
  }
  $('result-reason').textContent = completed ? '最後までおつかれさま！' : 'ここまでの学習を記録しました。';
  $('result-stats').replaceChildren();
  $('result-total-score').textContent = game.totalScore.toLocaleString();
  const rhythmBase = game.judgments.PERFECT * 10 + game.judgments.GOOD * 5;
  const quizBase = game.correctCount * 50;
  const columns = [
    ['リズム', [
      ['リズム得点', game.rhythmScore.toLocaleString()], ['基本点', rhythmBase.toLocaleString()],
      ['コンボ加算', (game.rhythmScore - rhythmBase).toLocaleString()], ['最大リズムコンボ', game.maxCombo],
      ['PERFECT', `${game.judgments.PERFECT}回`], ['GOOD', `${game.judgments.GOOD}回`], ['MISS', `${game.judgments.MISS}回`]
    ]],
    ['問題', [
      ['正解得点', game.quizScore.toLocaleString()], ['基本点', quizBase.toLocaleString()],
      ['コンボ加算', (game.quizScore - quizBase).toLocaleString()], ['最大一発正解コンボ', game.maxQuizCombo],
      ['正答回数', `${game.correctCount}回`], ['お手付き回数', `${game.wrongCount}回`], ['一発正解', `${game.firstCount}回`]
    ]]
  ];
  for (const [title, entries] of columns) {
    const column = document.createElement('section'), heading = document.createElement('h2');
    column.className = 'result-column'; column.setAttribute('aria-label', `${title}の成績`);
    heading.textContent = title; column.append(heading);
    for (const [label, value] of entries) {
      const div = document.createElement('div'), strong = document.createElement('strong');
      div.textContent = label; strong.textContent = value; div.append(strong); column.append(div);
    }
    $('result-stats').append(column);
  }
  $('review').replaceChildren();
  for (const item of history) { const li = document.createElement('li'); li.textContent = `${item.first ? '一発正解' : '再挑戦で正解'} · ${item.label} — 正解：${item.answer} · ${item.note}`; $('review').append(li); }
  if (unfinished) { const li = document.createElement('li'); li.textContent = `未回答 · ${unfinished}（集計対象外）`; $('review').append(li); }
  if (!history.length && !unfinished) { const li = document.createElement('li'); li.textContent = '今回はリズムプレイのみでした。'; $('review').append(li); }
}
let resumeAfterHelp = false;
$('help').addEventListener('click', () => { resumeAfterHelp = !audio.paused; pause(); $('controls-help').showModal(); });
$('close-help').addEventListener('click', () => $('controls-help').close());
$('controls-help').addEventListener('close', () => { if (resumeAfterHelp) { resumeAfterHelp = false; togglePause(); } });
$('start').addEventListener('click', start); $('again').addEventListener('click', start);
$('back').addEventListener('click', () => show('home')); $('pause').addEventListener('click', togglePause);
$('quit').addEventListener('click', () => finish(false));
audio.addEventListener('ended', async () => {
  if (screen !== 'play' || busy) return;
  if (trackIndex + 1 >= playlist.tracks.length) { finish(true); return; }
  busy = true; cancelAnimationFrame(frame);
  selectTrack(trackIndex + 1);
  game.update(playbackTime()); render(); draw();
  try {
    if (document.hidden || $('controls-help').open) { pause(); return; }
    await audio.play();
    if (screen !== 'play') { audio.pause(); return; }
    if (document.hidden || $('controls-help').open) { pause(); return; }
    $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop();
  } catch {
    pause(); game.message = '次の曲を再生できませんでした。再開を押してください。'; render();
  } finally { busy = false; }
});
audio.addEventListener('error', () => { if (screen === 'play') { pause(); game.message = '音声の読み込みに失敗しました。接続を確認してください。'; render(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => { if (screen === 'play') { render(); draw(); } });
let registration, updateAvailable = false;
let updateCheck;
async function checkForUpdate() {
  if (updateCheck) return updateCheck;
  registration?.update().catch(() => {});
  updateCheck = (async () => {
    try {
      const url = new URL('./version.json', location.href); url.searchParams.set('check', Date.now());
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const { version } = await response.json();
      if (!/^\d+\.\d+\.\d+$/.test(version)) return;
      const next = version.split('.').map(Number), current = VERSION.split('.').map(Number);
      const index = next.findIndex((part, i) => part !== current[i]);
      if (index < 0 || next[index] < current[index]) return;
      updateAvailable = true;
      $('connection').textContent = `更新あり · v${version}`;
      if (screen !== 'home') return;
      if (new URL(location.href).searchParams.get('release') === version) {
        $('update-status').textContent = '切り替わらない場合は「更新を復旧する」をお試しください。'; return;
      }
      const target = new URL('./', location.href);
      target.searchParams.set('release', version); target.searchParams.set('update', Date.now());
      location.replace(target.href);
    } catch { /* Offline play remains available. */ }
  })().finally(() => { updateCheck = null; });
  return updateCheck;
}
$('refresh-app').addEventListener('click', async () => {
  $('refresh-app').disabled = true; $('update-status').textContent = '最新版を確認しています…';
  try {
    const url = new URL('./', location.href); url.searchParams.set('update', Date.now());
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok || response.headers.get('X-Study-Offline')) throw new Error('offline');
    location.replace(url.href);
  } catch {
    $('update-status').textContent = '更新を取得できませんでした。通信を確認して、もう一度お試しください。';
    $('refresh-app').disabled = false;
  }
});
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (screen === 'home') location.reload();
    else { updateAvailable = true; $('connection').textContent = '更新あり · ホームから更新'; }
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (updateAvailable) return;
    const labels = { MEDIA_LOADING: 'オフライン保存中', MEDIA_READY: 'OFFLINE READY', MEDIA_ERROR: 'オンラインで利用可能' };
    if (labels[event.data?.type]) $('connection').textContent = labels[event.data.type];
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async value => {
    registration = value; checkForUpdate();
    const ready = await navigator.serviceWorker.ready;
    ready.active?.postMessage({ type: 'CACHE_MEDIA' });
  }).catch(() => { $('connection').textContent = 'ONLINE MODE'; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
}
window.addEventListener('online', checkForUpdate);
checkForUpdate();
load();
