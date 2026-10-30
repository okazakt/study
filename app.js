import { Game, RULES, COLORS } from './game.js';
const $ = id => document.getElementById(id);
const audio = $('audio');
let questions, chart, track, game, frame, busy = false, history = [], screen = 'home';
let cachedUI = '';
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
  history = []; cachedUI = ''; show('play'); render(); draw(); $('pause').disabled = true;
  try { await audio.play(); $('pause').textContent = '一時停止'; $('pause-overlay').hidden = true; loop(); }
  catch { show('home'); $('load-status').textContent = '音声を再生できませんでした。接続を確認して、もう一度開始してください。'; }
  finally { busy = false; $('start').disabled = false; $('pause').disabled = false; }
}
function render() {
  $('rhythm-score').textContent = game.rhythmScore.toLocaleString(); $('rhythm-combo').textContent = game.combo;
  $('quiz-score').textContent = game.quizScore.toLocaleString(); $('quiz-combo').textContent = game.quizCombo;
  $('time').textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || track.durationSeconds)}`;
  const remaining = Math.max(0, Math.ceil(RULES.readSeconds - (game.time - game.phaseStart)));
  const key = JSON.stringify([game.phase, game.questionIndex, game.counts, game.message, remaining]);
  if (key === cachedUI) return; cachedUI = key;
  const q = game.question;
  $('phase-label').textContent = ({intro:'WARM UP',read:`READ · ${remaining}秒`,answer:'ANSWER · 答えの色を3回',feedback:'CORRECT'})[game.phase] || '';
  $('question-number').textContent = game.phase === 'intro' ? '白ノーツはどこでもタップ' : `Q ${game.questionIndex + 1} · ${q.grade} ${q.subject} / ${q.field}`;
  $('prompt').textContent = game.phase === 'intro' ? 'まずはリズムにのろう' : q.prompt;
  $('instruction').textContent = game.message;
  $('choices').replaceChildren();
  if (game.phase !== 'intro') q.choices.forEach((choice, i) => {
    const el = document.createElement('div'); el.className = 'choice'; el.style.setProperty('--color', COLORS[i].value);
    if (game.phase === 'feedback' && i === q.correct) el.classList.add('correct');
    el.textContent = `${COLORS[i].symbol} ${COLORS[i].name} / ${choice}`;
    const count = document.createElement('span'); count.className = 'count';
    count.textContent = '●'.repeat(game.counts[i]) + '○'.repeat(Math.max(0, RULES.tapsToAnswer - game.counts[i]));
    el.append(count); $('choices').append(el);
  });
  $('explanation').textContent = game.phase === 'feedback' ? `${q.term}：${q.note}` : '';
}
const canvas = $('canvas'); const ctx = canvas.getContext('2d');
function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const laneWidth = width / RULES.lanes, line = height - 40;
  for (let i = 0; i < RULES.lanes; i++) {
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
  if (screen !== 'play' || audio.paused || busy) return;
  const q = game.question, first = game.firstTry, previousCount = game.correctCount;
  game.tap(lane, audio.currentTime);
  if (game.correctCount > previousCount) history.push({ term:q.term, note:q.note, first });
  render(); draw();
}
$('field').addEventListener('pointerdown', event => {
  event.preventDefault(); const bounds = canvas.getBoundingClientRect();
  tap(Math.max(0, Math.min(4, Math.floor((event.clientX - bounds.left) / bounds.width * RULES.lanes))));
});
document.querySelectorAll('[data-lane]').forEach(button => button.addEventListener('pointerdown', event => { event.preventDefault(); tap(Number(button.dataset.lane)); }));
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
window.addEventListener('resize', () => { if (screen === 'play') draw(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    if (registration.active) $('connection').textContent = 'PWA READY';
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => { if (installing.state === 'activated') $('connection').textContent = 'OFFLINE READY'; });
  }).catch(() => { $('connection').textContent = 'ONLINE MODE'; });
}
load();
