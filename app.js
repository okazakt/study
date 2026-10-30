import { Game, RULES, COLORS } from './game.js';
const $ = id => document.getElementById(id);
const audio = $('audio');
let questions, chart, track, game, frame, busy = false, history = [], screen = 'home';
let questionKey = '';
let characters = [], choiceElements = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
try { $('offset').value = localStorage.getItem('study-beat-offset-ms') || '0'; } catch { /* Private browsing may disable storage. */ }
$('offset').addEventListener('change', () => {
  $('offset').value = Math.max(-500, Math.min(500, Number($('offset').value) || 0));
  try { localStorage.setItem('study-beat-offset-ms', $('offset').value); } catch { /* Play remains available. */ }
});
const show = next => { screen = next; for (const name of ['home', 'play', 'result']) $(name).hidden = name !== next; };
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
async function json(path) { const r = await fetch(path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
async function load() {
  try {
    const [index, quiz] = await Promise.all([json('./music-data/index.json'), json('./quiz-data/junior_science.json')]);
    track = index['0001']; questions = quiz;
    chart = await json(`./music-data/${track.files.chart}`);
    if (!questions.length || !chart.events.length) throw new Error('データが空です');
    audio.src = `./music-data/${track.files.audio}`;
    $('start').disabled = false; $('start').textContent = 'プレイをはじめる →';
  } catch (error) { $('load-status').textContent = `データの読み込みに失敗しました。ページを再読み込みしてください。 (${error.message})`; }
}
async function start() {
  if (busy) return; busy = true; $('start').disabled = true;
  cancelAnimationFrame(frame); audio.pause(); audio.currentTime = 0;
  const offsetMs = (track.timing.chartToAudioOffsetMs || 0) + (Number($('offset').value) || 0);
  game = new Game(questions, chart.events, offsetMs / 1000);
  history = []; questionKey = ''; show('play'); render(); draw(); $('pause').disabled = true;
  try { await audio.play(); $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop(); }
  catch { show('home'); $('load-status').textContent = '音声を再生できませんでした。接続を確認して、もう一度開始してください。'; }
  finally { busy = false; $('start').disabled = false; $('pause').disabled = false; }
}
function appendCharacters(element, text, start) {
  element.replaceChildren(); element.setAttribute('aria-label', text);
  Array.from(text).forEach((character, index) => {
    const span = document.createElement('span'); span.className = 'reveal-char';
    span.textContent = character; span.setAttribute('aria-hidden', 'true'); element.append(span);
    characters.push({ element: span, start: start + index * RULES.charSeconds });
  });
}
function renderQuestion() {
  const intro = game.phase === 'intro';
  const key = `${intro}:${game.questionIndex}`;
  if (key === questionKey) return;
  questionKey = key; characters = []; choiceElements = []; $('choices').replaceChildren();
  const q = game.question;
  appendCharacters($('prompt'), intro ? 'まずはリズムにのろう' : q.prompt, game.reveal.prompt.start);
  if (!intro) q.choices.forEach((choice, i) => {
    const el = document.createElement('div'); el.className = 'choice'; el.style.setProperty('--color', COLORS[i].value);
    const symbol = document.createElement('span'); symbol.textContent = `${COLORS[i].symbol} `; symbol.setAttribute('aria-hidden', 'true'); el.append(symbol);
    const text = document.createElement('span'); appendCharacters(text, choice, game.reveal.choices[i].start); el.append(text);
    const count = document.createElement('span'); count.className = 'count'; el.append(count);
    choiceElements.push({ element: el, count, start: game.reveal.choices[i].start }); $('choices').append(el);
  });
}
function positionQuestion(elapsed) {
  const panel = $('question-panel');
  // Reserve the final position, then place the same panel above the touch line.
  $('question-slot').style.height = `${panel.offsetHeight}px`;
  const stage = $('play-stage').getBoundingClientRect(), field = $('field').getBoundingClientRect();
  const lower = Math.max(0, field.bottom - stage.top - 72 - panel.offsetHeight);
  const progress = Math.max(0, Math.min(1, (elapsed - game.reveal.liftStart) / RULES.liftSeconds));
  const ease = progress * progress * (3 - 2 * progress);
  const lift = reducedMotion.matches ? (progress === 1 ? 1 : 0) : ease;
  panel.style.transform = `translate3d(0,${game.phase === 'read' ? lower * (1 - lift) : 0}px,0)`;
}
function render() {
  $('rhythm-score').textContent = game.rhythmScore.toLocaleString(); $('rhythm-combo').textContent = game.combo;
  $('quiz-score').textContent = game.quizScore.toLocaleString(); $('quiz-combo').textContent = game.quizCombo;
  $('time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || track.durationSeconds)}`;
  renderQuestion();
  const q = game.question, elapsed = game.time - game.phaseStart;
  $('play').dataset.phase = game.phase;
  $('field').setAttribute('aria-label', game.phase === 'answer' ? '4色の回答エリア。左からD F G H' : '白ノーツのタップエリア');
  document.querySelectorAll('[data-lane]').forEach(button => { button.hidden = Number(button.dataset.lane) >= game.laneCount; });
  document.querySelector('.lane-keys').style.gridTemplateColumns = `repeat(${game.laneCount},1fr)`;
  document.querySelector('.play-hint').textContent = game.phase === 'read' ? '今は読む時間。タップはお休みです。' : game.phase === 'answer' ? '4色が横一列に到着。答えの色だけを3回タップ。' : '白ノーツは、どこでもタップ。';
  $('phase-label').textContent = ({intro:'WARM UP · 4拍に1回',read:'READ',answer:'ANSWER · 答えの色を3回',feedback:'CORRECT'})[game.phase] || '';
  $('question-number').textContent = game.phase === 'intro' ? '白ノーツはどこでもタップ' : `Q ${game.questionIndex + 1} · ${q.grade} ${q.subject} / ${q.field}`;
  $('instruction').textContent = game.message;
  for (const character of characters) {
    const opacity = game.phase === 'read' ? Math.max(0, Math.min(1, (elapsed - character.start) / RULES.fadeSeconds)) : 1;
    character.element.style.opacity = reducedMotion.matches ? Number(opacity > 0) : opacity;
  }
  choiceElements.forEach(({element, count, start}, i) => {
    element.style.opacity = game.phase === 'read' ? Math.max(0, Math.min(1, (elapsed - start) / RULES.fadeSeconds)) : 1;
    element.classList.toggle('correct', game.phase === 'feedback' && i === q.correct);
    count.textContent = '●'.repeat(game.counts[i]) + '○'.repeat(Math.max(0, RULES.tapsToAnswer - game.counts[i]));
  });
  $('explanation').textContent = game.phase === 'feedback' ? `${q.term}：${q.note}` : '';
  positionQuestion(elapsed);
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
    ctx.fillStyle = '#ffffff25'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(['D', 'F', 'G', 'H', 'J'][i], (i + .5) * laneWidth, height - 12);
  }
  ctx.fillStyle = '#a8f07d10'; ctx.fillRect(0, line - 13, width, 26);
  ctx.strokeStyle = '#b8ed96'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, line); ctx.lineTo(width, line); ctx.stroke();
  for (const note of game.notes) {
    if (note.done) continue;
    const y = line * (1 - (note.target - audio.currentTime) / RULES.travelSeconds);
    const white = note.color === null;
    const x = white ? 8 : note.lane * laneWidth + 8;
    const w = white ? width - 16 : laneWidth - 16;
    ctx.fillStyle = white ? '#e5edf7' : COLORS[note.color].value;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(x, y - 10, w, 20, 5); ctx.fill(); ctx.shadowBlur = 0;
    if (!white) { ctx.fillStyle = '#172033'; ctx.font = 'bold 14px system-ui'; ctx.fillText(COLORS[note.color].symbol, x + w / 2, y + 5); }
  }
  if (audio.currentTime - game.judgmentTime < .55) {
    ctx.font = 'bold 21px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = game.lastJudgment === 'PERFECT' ? '#a8f07d' : '#eef2fa';
    ctx.fillText(game.lastJudgment, width / 2, line - 44);
  }
}
function loop() {
  if (!game || screen !== 'play') return;
  game.update(audio.currentTime); render(); draw();
  if (!audio.paused) frame = requestAnimationFrame(loop);
}
function tap(lane) {
  if (screen !== 'play' || audio.paused || busy || lane >= game.laneCount) return;
  const q = game.question, first = game.firstTry, previousCount = game.correctCount;
  game.tap(lane, audio.currentTime);
  if (game.correctCount > previousCount) history.push({ term:q.term, note:q.note, first });
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
  if (screen !== 'play' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const lane = ['KeyD','KeyF','KeyG','KeyH','KeyJ'].indexOf(event.code);
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
  busy = true;
  try { await audio.play(); $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop(); }
  catch { game.message = '再生できませんでした。再開を押して再試行してください。'; render(); }
  finally { busy = false; }
}
function finish(completed) {
  if (screen !== 'play') return;
  audio.pause(); cancelAnimationFrame(frame);
  const unfinished = game.phase !== 'intro' && game.phase !== 'feedback' ? game.question.term : null;
  game.finish(); show('result');
  $('result-reason').textContent = completed ? '最後までおつかれさま！' : 'ここまでの学習を記録しました。';
  $('result-stats').replaceChildren();
  [['リズムスコア', game.rhythmScore.toLocaleString()],['学習スコア（一発正解）',game.quizScore.toLocaleString()],['最大リズムコンボ',game.maxCombo],['最大一発正解コンボ',game.maxQuizCombo],['正解した問題',`${game.correctCount}問`],['一発正解',`${game.firstCount}問`]].forEach(([label,value]) => {
    const div = document.createElement('div'); div.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; div.append(strong); $('result-stats').append(div);
  });
  $('review').replaceChildren();
  for (const item of history) { const li = document.createElement('li'); li.textContent = `${item.first ? '一発正解' : '再挑戦で正解'} · ${item.term} — ${item.note}`; $('review').append(li); }
  if (unfinished) { const li = document.createElement('li'); li.textContent = `未回答 · ${unfinished}（集計対象外）`; $('review').append(li); }
  if (!history.length && !unfinished) { const li = document.createElement('li'); li.textContent = '今回はウォームアップのみでした。'; $('review').append(li); }
}
$('start').addEventListener('click', start); $('again').addEventListener('click', start);
$('back').addEventListener('click', () => show('home')); $('pause').addEventListener('click', togglePause);
$('quit').addEventListener('click', () => finish(false)); audio.addEventListener('ended', () => finish(true));
audio.addEventListener('error', () => { if (screen === 'play') { pause(); game.message = '音声の読み込みに失敗しました。接続を確認してください。'; render(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', () => { if (screen === 'play') { render(); draw(); } });
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (screen === 'home') location.reload();
    else $('connection').textContent = '更新あり · 再読込で反映';
  });
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    if (registration.active) $('connection').textContent = 'PWA READY';
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => { if (installing.state === 'activated') $('connection').textContent = 'OFFLINE READY'; });
  }).catch(() => { $('connection').textContent = 'ONLINE MODE'; });
}
load();
