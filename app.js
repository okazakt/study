import {FocusGame} from './focus-game.js?v=0.60.0';
import {TEXTBOOK_KEY,availableTextbookSeries,normalizeTextbookSettings,textbookBooks,textbookUnits,selectTextbookQuestions} from './textbooks.js?v=0.60.0';
import { ScreenWakeLock } from './wake-lock.js?v=0.60.0';
import { MusicPlayer } from './music-player.js?v=0.60.0';
import { TIMING_KEY, OUTPUTS, defaultTimingOffset, normalizeTiming, effectiveOffset, clampOffset, TimingCalibrator, calibrationPattern, matchCalibrationBeat, timingReport } from './calibration.js?v=0.60.0';
import { HISTORY_KEY, normalizeHistory, recordAnswer, learningLevel, missedQuestions, BEST_KEY, SCORE_BEST_KEY, normalizeBests, updateBests, createAdaptivePicker, questionCoverage } from './progress.js?v=0.60.0';
import { Game, RULES, COLORS, SPEEDS, RHYTHMS, normalizeGameplayOptions, answerProgress, makePlaylist, sessionMusic, normalizeMusicSelection, musicCredit, makeQuestionQueue, sessionPlan, sessionGain, SESSION, seededRandom, perfectReference } from './game.js?v=0.60.0';
import { buildCatalog, normalizePreferences, selectQuestions, practiceTypes, matchesPracticeItem, matchesPracticeQuestion, sectionKey, choiceColumns } from './learning.js?v=0.60.0';
const VERSION = '0.60.0';
const $ = id => document.getElementById(id);
const audio = $('audio');
const screenWakeLock=new ScreenWakeLock(navigator.wakeLock,()=>!document.hidden);
let questions, playlist, track, trackIndex = 0, game, frame, busy = false, history = [], screen = 'home';
let session, musicContext, musicGain, musicPlayer, musicEntries=[], tuningTracks=[], playedTracks=[];
let textbookData, textbookSettings, savedTextbooks=null;
try { savedTextbooks=JSON.parse(localStorage.getItem(TEXTBOOK_KEY)||'null'); }catch{}
let selectedMusic=null;
try {
  const saved=localStorage.getItem('study-beat-music-selection-v2');
  selectedMusic=saved===null?localStorage.getItem('study-beat-fixed-music-v1'):JSON.parse(saved);
} catch {}
let gameplayOptions=normalizeGameplayOptions(null);
try { gameplayOptions=normalizeGameplayOptions(JSON.parse(localStorage.getItem('study-beat-gameplay-v1')||'null')); } catch {}
for(const [id,key,values] of [['question-speed','speed',SPEEDS],['rhythm-difficulty','rhythm',RHYTHMS]]){
  for(const [value,entry] of Object.entries(values)){
    const button=document.createElement('button');button.type='button';button.dataset.value=value;
    button.textContent=typeof entry==='string'?entry:entry.label;
    button.setAttribute('aria-pressed',String(gameplayOptions[key]===value));
    button.addEventListener('click',()=>{
      gameplayOptions[key]=value;
      for(const sibling of $(id).querySelectorAll('button'))sibling.setAttribute('aria-pressed',String(sibling===button));
      try { localStorage.setItem('study-beat-gameplay-v1',JSON.stringify(gameplayOptions));$('gameplay-storage-note').hidden=true; }catch{$('gameplay-storage-note').hidden=false;}
    });$(id).append(button);
  }
}
let questionKey = '', hitEffects = [], ghostPressTimes = Array(4).fill(-Infinity), tuningPressTime = -Infinity;
let learningHistory = normalizeHistory(null), sessionScope, sessionId = '', sessionResults = new Map(), levelPrevious = null;
let personalBests = normalizeBests(null), resultTimer;
try { personalBests = normalizeBests(JSON.parse(localStorage.getItem(BEST_KEY) || 'null'));personalBests.totalScore=Number(localStorage.getItem(SCORE_BEST_KEY)) || 0; } catch {}
let reviewQuestions = [], reviewIndex = 0, reviewSolved = false, reviewWrong = 0;
try {
  const stored=localStorage.getItem(HISTORY_KEY), raw=JSON.parse(stored || 'null');
  learningHistory=normalizeHistory(raw);
  if(raw?.version===1 && stored!==JSON.stringify(learningHistory)){
    try { localStorage.setItem(HISTORY_KEY,JSON.stringify(learningHistory)); }
    catch { $('history-storage-note').hidden=false; }
  }
} catch {}
let characters = [], choiceElements = [];
let catalogQuestions = [], reviewRun = '';
let catalog, preferences, activeSubject = '', dataReady = false, savedLearning;
try { savedLearning = JSON.parse(localStorage.getItem('study-beat-learning-v1') || 'null'); } catch { /* Use the first-run school selector. */ }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let timingPersistence = true, outputConfirmed = false;
let tuningPattern = [];
let timingSettings = normalizeTiming(null), tuningSession = null, tuningConsumed = new Set(), tuningRound = 0, tuningLastTime = 0, tuningMessage = '', tuningFeedback = '', tuningFeedbackAt = -10, tuningGeneration = 0, tuningStarting = false;
try { timingSettings = normalizeTiming(JSON.parse(localStorage.getItem(TIMING_KEY) || 'null'), localStorage.getItem('study-beat-offset-ms')); } catch {}
const signedMs = n => `${Math.round(n) > 0 ? '+' : ''}${Math.round(n)}ms`;
for (const id of ['timing-output','tuning-output']) {
  for (const [key,label] of OUTPUTS) { const option = document.createElement('option'); option.value = key; option.textContent = label; $(id).append(option); }
  $(id).addEventListener('change', () => {
    selectTimingOutput($(id).value);
  });
}
function persistTiming() {
  try {
    localStorage.setItem(TIMING_KEY, JSON.stringify(timingSettings));
    localStorage.setItem('study-beat-offset-ms', String(effectiveOffset(timingSettings)));
    timingPersistence = true; return true;
  } catch { timingPersistence = false; return false; }
}
function syncTimingUi() {
  const output = timingSettings.activeOutput, profile = timingSettings.profiles[output];
  $('timing-output').value = output; $('tuning-output').value = output; $('offset').value = effectiveOffset(timingSettings);
  $('timing-saved').textContent = `適用値 ${signedMs(effectiveOffset(timingSettings))}（${!timingPersistence ? '保存できません・今回のみ' : profile ? '保存済み' : '共通初期値'}）`;
  $('open-timing-report').disabled = !profile;
}
syncTimingUi();
$('offset').addEventListener('change', () => {
  timingSettings.profiles[timingSettings.activeOutput] = {offsetMs:clampOffset(Number($('offset').value)||0),method:'manual'};
  persistTiming(); syncTimingUi();
});
function selectTimingOutput(output) {
  timingSettings.activeOutput = output;
  if(output==='speaker'){
    speakerTapSoundEnabled=true;
    try { localStorage.setItem('study-beat-tap-sound','on'); } catch {}
  }
  tapSoundEnabled = output === 'bluetooth' ? false : speakerTapSoundEnabled;
  persistTiming(); syncTimingUi(); syncSoundUi();
  if (!tapSoundEnabled && tapAudio && tapAudio.state !== 'closed') tapAudio.suspend().catch(() => {});
  if (screen === 'tuning') resetTuning();
}
// Route music once through a gain node (HTML volume alone is ignored on iOS).
function prepareMusicAudio() {
  try { if(navigator.audioSession && navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'; } catch {}
  const Context=window.AudioContext || window.webkitAudioContext;
  if(!Context)return Promise.resolve();
  if(!musicContext){
    const context=new Context({latencyHint:'interactive'}),gain=context.createGain();
    const source=context.createMediaElementSource(audio);
    source.connect(gain);gain.connect(context.destination);
    musicContext=context;musicGain=gain;
    context.addEventListener('statechange',()=>{
      if(screen==='play' && !busy && (musicPlayer?.running || !audio.paused) && context.state!=='running')interruptPlay('音楽が中断されたためプレイを終了しました。ここまでの回答は記録済みです。');
    });
  }
  return musicContext.state!=='running'?musicContext.resume():Promise.resolve();
}
function setMusicGain(value) {
  if(musicGain)musicGain.gain.value=value;
  else audio.volume=value;
}
function suspendMusicAudio() { musicContext?.suspend().catch(()=>{}); }
// Short percussion with a clear attack, independent of the song clock.
let tapAudioProbe, tapAudio, tapNoise, tapAudioNeedsReset = false, tapSoundEnabled = true, speakerTapSoundEnabled = true, tapVolume = 60;
try {
  speakerTapSoundEnabled = localStorage.getItem('study-beat-tap-sound') !== 'off';
  const saved = localStorage.getItem('study-beat-tap-volume-v2');
  const legacy = localStorage.getItem('study-beat-tap-volume');
  if(saved!==null && Number.isFinite(Number(saved)))tapVolume=Math.max(0,Math.min(100,Number(saved)));
  else if(legacy!==null && Number.isFinite(Number(legacy))){
    tapVolume=Math.round(Math.max(0,Math.min(100,Number(legacy)))*.6);
    localStorage.setItem('study-beat-tap-volume-v2',String(tapVolume));
  }
} catch {}
tapSoundEnabled = timingSettings.activeOutput === 'bluetooth' ? false : speakerTapSoundEnabled;
function syncSoundUi() {
  for (const id of ['tap-sound','help-tap-sound','tuning-tap-sound']) $(id).checked = tapSoundEnabled;
  const bluetooth = timingSettings.activeOutput === 'bluetooth';
  $('bluetooth-notice').hidden = !bluetooth;
  $('bluetooth-notice').textContent = tapSoundEnabled ? 'Bluetoothのタップ音はオンです（遅れて聞こえるため非推奨）。チューニングモードで変更できます。' : 'Bluetoothイヤホンではタップ音が遅れて聞こえるため、タップ音はオフになります。チューニングモードで変更できます。';
  $('tuning-sound-note').textContent = bluetooth ? 'Bluetoothは遅れて聞こえるためオフ推奨' : '';
  soundStatus(tapSoundEnabled ? '' : 'タップ音はオフです');
}
function soundStatus(message) {
  for (const prefix of ['', 'help-']) $(`${prefix}tap-audio-status`).textContent = message;
}
for (const id of ['tap-sound', 'help-tap-sound', 'tuning-tap-sound']) {
  $(id).checked = tapSoundEnabled;
  $(id).addEventListener('change', () => {
    tapSoundEnabled = $(id).checked;
    if (timingSettings.activeOutput !== 'bluetooth') {
      speakerTapSoundEnabled = tapSoundEnabled;
      try { localStorage.setItem('study-beat-tap-sound', tapSoundEnabled ? 'on' : 'off'); } catch {}
    }
    syncSoundUi();
    if (tapSoundEnabled) prepareTapAudio()?.catch(() => {});
  });
}
syncSoundUi();
for (const prefix of ['', 'help-']) {
  const slider = $(`${prefix}tap-volume`);
  slider.value = tapVolume; $(`${prefix}tap-volume-value`).value = `${tapVolume}%`;
  slider.addEventListener('input', () => {
    tapVolume = Number(slider.value);
    for (const other of ['', 'help-']) {
      $(`${other}tap-volume`).value = tapVolume;
      $(`${other}tap-volume-value`).value = `${tapVolume}%`;
    }
    try { localStorage.setItem('study-beat-tap-volume-v2', String(tapVolume)); } catch {}
  });
  $(`${prefix}tap-preview`).addEventListener('click', () => playTapSound(true));
  $(`${prefix}tap-preview-miss`).addEventListener('click', () => playTapSound(true, 'MISS'));
}
function prepareTapAudio(fresh = false) {
  if (!tapSoundEnabled) return null;
  try {
    // On supported iOS versions use the same playback category as the music.
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch { /* Not supported on every browser. */ }
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) { soundStatus('このブラウザではタップ音を再生できません'); return null; }
    if (fresh || tapAudioNeedsReset || !tapAudio || tapAudio.state === 'closed') {
      const old = tapAudio; tapAudio = null; tapNoise = null; tapAudioNeedsReset = false;
      if (old && old.state !== 'closed') old.close().catch(() => {});
      tapAudio = new Context({ latencyHint: 'interactive' });
    }
    // Safari may report interrupted after another audio session or backgrounding.
    const context = tapAudio;
    const ready = context.state !== 'running' ? context.resume() : Promise.resolve();
    return ready.catch(error => {
      if (tapAudio === context) tapAudioNeedsReset = true;
      throw error;
    });
  } catch { tapAudioNeedsReset = true; soundStatus('タップ音を再生できません。試聴をもう一度押してください'); return null; }
}
function verifyTapAudioClock() {
  clearTimeout(tapAudioProbe);
  const context = tapAudio;
  if (!context || !tapSoundEnabled) return;
  const before = context.currentTime;
  tapAudioProbe = setTimeout(() => {
    if (tapAudio !== context || document.hidden || !['play','tuning'].includes(screen) || !musicIsPlaying()) return;
    // Some mobile contexts report running even though their audio clock is stuck.
    if (context.state !== 'running' || context.currentTime <= before + .001) tapAudioNeedsReset = true;
  }, 150);
}
function emitTapSound(judgment) {
  const t = tapAudio.currentTime, gain = tapAudio.createGain();
  gain.gain.setValueAtTime(tapVolume / 60 * 4, t);
  // 60% matches the previous 100%; retain soft peak limiting.
  const limiter = tapAudio.createWaveShaper(), curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
    curve[i] = Math.sign(x) * (magnitude <= .8 ? magnitude : .8 + .18 * Math.tanh((magnitude - .8) / .18));
  }
  limiter.curve = curve; limiter.oversample = 'none';
  gain.connect(limiter); limiter.connect(tapAudio.destination);
  if (judgment !== 'MISS') {
    const frequencies = [1567.98, 2093.00, 3135.96];
    frequencies.forEach((frequency, index) => {
      const tone = tapAudio.createOscillator(), envelope = tapAudio.createGain(), start = t + index * .018;
      tone.type = 'sine'; tone.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(.22 / (1 + index * .3), start + .003);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + .16);
      tone.connect(envelope); envelope.connect(gain);
      tone.onended = () => {
        tone.disconnect(); envelope.disconnect();
        if (index === frequencies.length - 1) { gain.disconnect(); limiter.disconnect(); }
      };
      tone.start(start); tone.stop(start + .17);
    });
    return;
  }
  const tone = tapAudio.createOscillator();
  const envelope = tapAudio.createGain();
  envelope.gain.setValueAtTime(.0001, t);
  envelope.gain.exponentialRampToValueAtTime(.8, t + .002);
  envelope.gain.exponentialRampToValueAtTime(.0001, t + .085);
  tone.type = 'triangle'; tone.frequency.setValueAtTime(1100, t);
  tone.frequency.exponentialRampToValueAtTime(480, t + .055);
  tone.connect(envelope); envelope.connect(gain);
  if (!tapNoise) {
    tapNoise = tapAudio.createBuffer(1, Math.ceil(tapAudio.sampleRate * .04), tapAudio.sampleRate);
    const data = tapNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .3 * (1 - i / data.length) ** 2;
  }
  const noise = tapAudio.createBufferSource(), filter = tapAudio.createBiquadFilter();
  noise.buffer = tapNoise; filter.type = 'highpass'; filter.frequency.value = 1400;
  noise.connect(filter); filter.connect(gain);
  noise.onended = () => { noise.disconnect(); filter.disconnect(); };
  tone.onended = () => { tone.disconnect(); envelope.disconnect(); gain.disconnect(); limiter.disconnect(); };
  noise.start(t); tone.start(t); tone.stop(t + .09);
}
function playTapSound(preview = false, judgment = 'GOOD') {
  if (!tapSoundEnabled) { if (preview) soundStatus('タップ音をオンにして試聴してください'); return; }
  if (!tapVolume) { if (preview) soundStatus('タップ音量を上げて試聴してください'); return; }
  const requested = performance.now();
  let requestedContext;
  const play = () => {
    if (!tapSoundEnabled || !tapVolume || tapAudio !== requestedContext) return;
    if (tapAudio?.state !== 'running') { if (preview) soundStatus('音を開始できません。もう一度試聴してください'); return; }
    if (!preview && (performance.now() - requested > 100 || !['play','tuning'].includes(screen) || !musicIsPlaying())) return;
    try { emitTapSound(judgment); if (preview) soundStatus('試聴しました'); }
    catch { soundStatus('タップ音を再生できません。もう一度試聴してください'); }
  };
  const ready = prepareTapAudio(); requestedContext = tapAudio;
  if (tapAudio?.state === 'running') { ready?.catch(() => {}); play(); }
  else ready?.then(play).catch(() => { if (preview) soundStatus('音を開始できません。もう一度試聴してください'); });
}
// A touch-end gesture also unlocks audio on browsers that restrict pointer-down.
document.addEventListener('touchend', () => {
  if (screen === 'play' || screen === 'tuning') prepareTapAudio()?.catch(() => {});
}, { passive: true });
let displayDiagnostics=null;
try { displayDiagnostics=JSON.parse(localStorage.getItem('study-beat-display-diagnostics-v1')||'null'); } catch {}
function capturePlayLayout(){
  if(screen!=='play')return;
  const rect=element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
  const viewport=window.visualViewport,buttons=$('play').querySelector('.lane-keys'),main=document.querySelector('main');
  const controls=[...buttons.querySelectorAll('button')].filter(button=>!button.hidden).map(button=>({lane:Number(button.dataset.lane),...rect(button)}));
  const actualBottom=Math.min(...controls.map(button=>button.bottom));
  const top=getComputedStyle(main).paddingTop,bottom=getComputedStyle(document.documentElement).getPropertyValue('--screen-safe-bottom').trim();
  displayDiagnostics={version:VERSION,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,
    innerHeight:innerHeight,innerWidth:innerWidth,screenHeight:window.screen.height,
    visualViewport:viewport?{height:viewport.height,width:viewport.width,offsetTop:viewport.offsetTop,scale:viewport.scale}:null,
    safeTop:top,safeBottom:bottom,body:rect(document.body),main:rect(main),buttons:rect(buttons),controls,
    unusedButtonArea:buttons.getBoundingClientRect().bottom-actualBottom,
    actualButtonBottomGap:(viewport?viewport.height+viewport.offsetTop:innerHeight)-actualBottom,
    pageBottomGap:(viewport?viewport.height+viewport.offsetTop:innerHeight)-buttons.getBoundingClientRect().bottom};
  try { localStorage.setItem('study-beat-display-diagnostics-v1',JSON.stringify(displayDiagnostics)); } catch {}
}
function showDisplayDiagnostics(){
  $('display-diagnostics').value=displayDiagnostics?JSON.stringify(displayDiagnostics,null,2):'プレイすると表示寸法を記録します。';
}
$('copy-display-diagnostics').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText($('display-diagnostics').value);$('display-copy-status').textContent='コピーしました。'; }
  catch { $('display-diagnostics').focus();$('display-diagnostics').select();$('display-copy-status').textContent='本文を選択しました。コピーしてください。'; }
});
const show = next => {
  const previousScreen = screen;
  if (next !== 'result') { clearTimeout(resultTimer); resultTimer = undefined; $('result-details').classList.remove('revealed'); }
  screen = next;screenWakeLock.setEnabled(next==='play');
  document.body.classList.toggle('playing', next === 'play' || next === 'tuning');
  document.documentElement.classList.toggle('play-locked', next === 'play' || next === 'tuning');
  for (const name of ['home', 'play', 'result', 'practice-review', 'tuning']) $(name).hidden = name !== next;
  if (next === 'result' && previousScreen === 'practice-review') $('result-details').hidden = false;
  window.scrollTo(0, 0);
  if(next==='play')requestAnimationFrame(capturePlayLayout);
  if (next === 'home') { if (dataReady) renderLearning(); checkForUpdate(); }
};
function saveAnswer(q, correct, chosen, wrongBefore, kind = 'play') {
  learningHistory = recordAnswer(learningHistory, q, {correct, chosen, wrongBefore, kind, session:sessionId, course:sessionScope?.id, version:VERSION, attempt:kind === 'play' ? `${sessionId}:play:${game.questionIndex}` : `${reviewRun}:${reviewIndex}`});
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(learningHistory)); }
  catch { $('history-storage-note').hidden = false; }
  if (kind === 'play') updateLearningLevel();
}
function updateLearningLevel() {
  const level = learningLevel(learningHistory, sessionScope);
  $('learning-level').textContent = level.value === null ? 'データ収集中' : level.value.toFixed(1);
  $('learning-level').classList.toggle('collecting', level.value === null);
  $('learning-level').title = `この教科・コースの直近${level.count}回答、異なる${level.distinct}問題。30回答・10問題から表示。`;
  const delta = level.value !== null && levelPrevious !== null ? Math.round((level.value - levelPrevious) * 10) / 10 : 0;
  $('learning-level-change').textContent = delta ? `${delta > 0 ? '↑ +' : '↓ '}${delta.toFixed(1)}` : '';
  $('learning-level-change').dataset.direction = delta < 0 ? 'down' : 'up';
  levelPrevious = level.value;
}

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
async function json(path) { const r = await fetch(`${path}?v=${VERSION}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
const selection = () => preferences?.profiles[preferences.school];
const textbookActive = course => !!textbookSettings?.series && /^中学:英語:(1|2|3|exam)$/.test(course || '');
const selectedQuestions = () => !dataReady ? [] : textbookActive(selection()?.id)
  ? selectTextbookQuestions(questions,textbookData,textbookSettings,selection())
  : selectQuestions(questions, preferences.school, selection(), catalog);
function saveTextbooks(){try{localStorage.setItem(TEXTBOOK_KEY,JSON.stringify(textbookSettings));$('textbook-storage-note').hidden=true;}catch{$('textbook-storage-note').hidden=false;}}
function renderTextbookSettings(){
 $('textbook-setting').replaceChildren(new Option('共通問題（教科書を指定しない）',''));
 const states={wordlist_only:'語彙一覧のみ確認・単元未対応',source_unavailable:'資料取得待ち',pending_source:'資料確認中',curriculum_only:'単元表のみ確認・語彙未対応'};
 for(const series of availableTextbookSeries(textbookData)){
  const option=new Option(`${series.title}／${series.publisher}${series.available?'（一部語彙対応）':`（${states[series.status]||'確認中'}）`}`,series.id);option.disabled=!series.available;$('textbook-setting').append(option);
 }
 $('textbook-setting').value=textbookSettings.series;
}
function renderTextbookUnits(course,entry){
 const active=textbookActive(course?.id);$('textbook-picker').hidden=!active;
 if(!active)return;
 const units=textbookUnits(textbookData,textbookSettings,course.id),books=textbookBooks(textbookData,textbookSettings,course.id);
 $('textbook-title').textContent=`${books.map(b=>b.title).join('・')} · 2026年度使用`;
 $('textbook-summary').textContent=`${books[0]?.title.replace(/ [123]$/,'') || ''}の単元を選ぶ`;
 $('textbook-note').textContent='令和7年度版。初出ページと訳語を照合できた一部の単語・熟語を出題します。未対応語があります。文法・読解は共通問題で選べます。';
 const generated=catalogQuestions.filter(q=>matchesPracticeQuestion(q,entry.practiceType||'all'));
 const available=units.filter(u=>u.items.some(row=>generated.some(q=>q.sourceId===row.sourceId)));
 const selected=textbookSettings.unitsByCourse[course.id];
 $('all-textbook-units').checked=selected===null || selected===undefined || available.length>0&&available.every(u=>selected.includes(u.id));
 $('all-textbook-units').indeterminate=Array.isArray(selected)&&selected.length>0&&!$('all-textbook-units').checked;
 $('textbook-unit-list').replaceChildren();
 for(const unit of units){
  const ids=new Set(unit.items.map(row=>row.sourceId)),qs=generated.filter(q=>ids.has(q.sourceId)),coverage=questionCoverage(qs,learningHistory);
  const label=document.createElement('label');label.className='section-option';const input=document.createElement('input');input.type='checkbox';input.dataset.textbookUnit=unit.id;input.disabled=!qs.length;input.checked=!!qs.length&&(!Array.isArray(selected)||selected.includes(unit.id));
  input.addEventListener('change',()=>{const chosen=new Set(Array.isArray(selected)?selected:available.map(u=>u.id));input.checked?chosen.add(unit.id):chosen.delete(unit.id);textbookSettings.unitsByCourse[course.id]=available.every(u=>chosen.has(u.id))?null:[...chosen];saveTextbooks();renderLearning();});
  const text=document.createElement('span');text.textContent=`${course.year==='exam'?`${unit.year}年 `:''}${unit.label}（p.${unit.pageStart}–${unit.pageEnd}） · ${qs.length?`出題済み ${coverage.solved} / ${coverage.total}問`:'対応問題は準備中'}`;label.append(input,text);$('textbook-unit-list').append(label);
 }
}
function saveLearning() {
  try { localStorage.setItem('study-beat-learning-v1', JSON.stringify(preferences)); }
  catch { $('learning-storage-note').hidden = false; }
}
function refreshStart() {
  const count = selectedQuestions().length;
  $('start').disabled = !outputConfirmed || busy || !count;
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
    const courseIds=new Set(textbookActive(course.id)?selectTextbookQuestions(questions,textbookData,textbookSettings,{id:course.id,practiceType:'all'},{allUnits:true}).map(q=>q.id):course.ids);
    const coverage = questionCoverage(catalogQuestions.filter(q=>courseIds.has(q.sourceId)), learningHistory);
    const detail = document.createElement('span'); detail.textContent = course.count ? `出題済み ${coverage.solved} / ${coverage.total}問` : '準備中';
    if (course.count && course.year === 'exam') detail.append(document.createElement('br'), `収録 ${course.grades.join('・')}`);
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
    const practiceItems = textbookActive(course.id)?selectTextbookQuestions(questions,textbookData,textbookSettings,entry,{allUnits:true}):questions.filter(item => course.ids.includes(item.id) && matchesPracticeItem(item,entry.practiceType || 'all'));
    const fields = [...new Set(practiceItems.map(item => item.field))], grades = [...new Set(practiceItems.map(item => item.grade))];
    $('course-coverage').textContent = `現在の収録：${grades.join('・')}／${fields.join('・')} · ${practiceItems.length}項目${course.year === 'exam' ? '（未収録の学年・分野は含みません）' : ''}`;
    const options = practiceTypes(course.subject);
    $('practice-picker').hidden = options.length === 1;
    $('practice-list').replaceChildren();
    for (const option of options) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.practice = option.id; button.textContent = option.label;
      button.disabled=textbookActive(course.id)&&!selectTextbookQuestions(questions,textbookData,textbookSettings,{...entry,practiceType:option.id},{allUnits:true}).length;
      button.setAttribute('aria-pressed', String(option.id === (entry.practiceType || 'all')));
      button.addEventListener('click', () => {
        if (entry.practiceType !== option.id) { entry.practiceType = option.id; entry.sections = null; saveLearning(); }
        renderLearning();
      });
      $('practice-list').append(button);
    }
    const generated = catalogQuestions.filter(q=>course.ids.includes(q.sourceId) && matchesPracticeQuestion(q,entry.practiceType || 'all'));
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
      const text = document.createElement('span'); const coverage = questionCoverage(generated.filter(q=>sectionKey(q)===section.key),learningHistory);
      text.textContent = `${section.label}（出題済み ${coverage.solved} / ${coverage.total}問）`;
      label.append(input, text); $('section-list').append(label);
    }
  }
  $('section-picker').hidden=textbookActive(course?.id);
  renderTextbookUnits(course,entry);
  const selectedIds = new Set(selectedQuestions().map(item=>item.id));
  const selectedCoverage = questionCoverage(catalogQuestions.filter(q=>selectedIds.has(q.sourceId) && matchesPracticeQuestion(q,selection()?.practiceType || 'all')),learningHistory);
  $('selection-status').textContent = course ? count ? `選択範囲：出題済み ${selectedCoverage.solved} / ${selectedCoverage.total}問` : '単元を1つ以上選んでください。'
    : !courses.some(course => course.count) ? `${school}の問題は準備中です。設定から学校を変更できます。`
    : courses.some(course => course.subject === activeSubject && course.count) ? '学年または受験用を選んでください。' : `${activeSubject}の問題は準備中です。ほかの教科を選んでください。`;
  refreshStart();
}
$('all-sections').addEventListener('change', () => { selection().sections = $('all-sections').checked ? null : []; saveLearning(); renderLearning(); });
document.querySelectorAll('[data-school]').forEach(button => button.addEventListener('click', () => setSchool(button.dataset.school)));
$('open-learning-settings').addEventListener('click', () => {showDisplayDiagnostics();$('display-copy-status').textContent='';$('learning-settings').showModal();});
$('close-learning-settings').addEventListener('click', () => $('learning-settings').close());
$('textbook-setting').addEventListener('change',()=>{
 textbookSettings=normalizeTextbookSettings({version:1,usageYear:2026,series:$('textbook-setting').value,unitsByCourse:{}},textbookData);
 if(textbookActive(selection()?.id)&&!selectTextbookQuestions(questions,textbookData,textbookSettings,selection(),{allUnits:true}).length)selection().practiceType='all';
 saveTextbooks();saveLearning();renderLearning();
});
$('all-textbook-units').addEventListener('change',()=>{textbookSettings.unitsByCourse[selection().id]=$('all-textbook-units').checked?null:[];saveTextbooks();renderLearning();});
function saveMusicSelection(){
  try { localStorage.setItem('study-beat-music-selection-v2',JSON.stringify(selectedMusic));$('music-storage-note').hidden=true; }
  catch { $('music-storage-note').hidden=false; }
}
function renderMusicSelection(){
  $('music-selection').value=selectedMusic?'selected':'all';
  $('music-list').hidden=!selectedMusic;
  for(const input of $('music-list').querySelectorAll('input'))input.checked=!!selectedMusic?.includes(input.value);
}
$('music-selection').addEventListener('change',()=>{
  selectedMusic=$('music-selection').value==='selected'?musicEntries.map(e=>e.id):null;
  $('music-selection-note').textContent='';saveMusicSelection();renderMusicSelection();
});
$('music-list').addEventListener('change',event=>{
  const chosen=[...$('music-list').querySelectorAll('input:checked')].map(input=>input.value);
  if(!chosen.length){event.target.checked=true;$('music-selection-note').textContent='少なくとも1曲選んでください。';return;}
  selectedMusic=chosen;$('music-selection-note').textContent='';saveMusicSelection();
});
$('school-setting').addEventListener('change', () => setSchool($('school-setting').value));
const musicIsPlaying=()=>screen==='play'&&musicPlayer ? musicPlayer.running && musicContext.state==='running' : !audio.paused;
const playbackTime = () => screen==='play'&&musicPlayer ? musicPlayer.time : track.start + audio.currentTime-(track.mediaStart||0);
function selectTrack(index, tuning=false) {
  trackIndex = index; track = (tuning ? tuningTracks : playlist.tracks)[index];
  audio.src = `./music-data/${track.files.audio}`;
  $('track-title').textContent = track.title;
  $('track-credit').textContent = `${index + 1} / ${playlist.tracks.length} · ${track.creator}`;
}
async function load() {
  try {
    const [index, quiz, english, japanese, math, social, expansion, englishCore, englishExtended, englishApplication, englishSupplement, englishVocabulary2, textbooks] = await Promise.all([json('./music-data/index.json'), json('./quiz-data/junior_science.json'), json('./quiz-data/junior_english.json'), json('./quiz-data/junior_japanese.json'), json('./quiz-data/junior_math.json'), json('./quiz-data/junior_social.json'), json('./quiz-data/junior_expansion.json'), json('./quiz-data/junior_english_core.json'), json('./quiz-data/junior_english_extended.json'), json('./quiz-data/junior_english_application.json'), json('./quiz-data/junior_english_supplement.json'), json('./quiz-data/junior_english_vocabulary2.json'), json('./textbook-data/english-2026.json')]);
    questions = [...quiz, ...english, ...japanese, ...math, ...social, ...expansion, ...englishCore, ...englishExtended, ...englishApplication, ...englishSupplement, ...englishVocabulary2];
    const entries = await Promise.all(Object.keys(index).map(async id => ({ id, track: index[id], chart: await json(`./music-data/${index[id].files.chart}`) })));
    musicEntries=entries;
    playlist = makePlaylist(entries); tuningTracks=makePlaylist(entries,{trim:false}).tracks;
    selectedMusic=normalizeMusicSelection(selectedMusic,entries.map(e=>e.id));
    for(const {id,track:song} of entries){
      const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
      input.type='checkbox';input.value=id;text.textContent=`${song.title} / ${song.creator}`;
      label.append(input,text);$('music-list').append(label);
    }
    renderMusicSelection();saveMusicSelection();
    if (!questions.length || !playlist.events.length) throw new Error('データが空です');
    selectTrack(0);
    tuningTracks.forEach((song,i) => { const option = document.createElement('option'); option.value = i; option.textContent = song.title; $('tuning-track').append(option); });
    $('open-tuning').disabled = !outputConfirmed;
    catalogQuestions = makeQuestionQueue(questions, () => .5);
    catalog = buildCatalog(questions); preferences = normalizePreferences(savedLearning, catalog);
    textbookData=textbooks;textbookSettings=normalizeTextbookSettings(savedTextbooks,textbookData);renderTextbookSettings();
    if(textbookActive(selection()?.id)&&!selectTextbookQuestions(questions,textbookData,textbookSettings,selection(),{allUnits:true}).length)selection().practiceType='all';
    activeSubject = catalog.find(course => course.id === selection()?.id)?.subject || '';
    dataReady = true; document.querySelectorAll('[data-school]').forEach(button => { button.disabled = false; });
    renderLearning();
  } catch (error) { $('load-status').textContent = `データの読み込みに失敗しました。ページを再読み込みしてください。 (${error.message})`; }
}
async function start() {
  if (busy || !outputConfirmed) return;
  const filtered = selectedQuestions(); if (!filtered.length) { refreshStart(); return; }
  prepareTapAudio()?.catch(() => {});
  busy = true; $('start').disabled = true;
  musicPlayer?.stop();if(musicPlayer)musicPlayer.stoppedTime=0;
  playlist=sessionMusic(musicEntries,selectedMusic,Math.random,SESSION.durationSeconds,{trim:!!(window.AudioContext||window.webkitAudioContext)});playedTracks=[];
  cancelAnimationFrame(frame); audio.pause(); audio.loop = false; audio.playbackRate = 1; selectTrack(0); audio.currentTime = 0;
  const offsetMs = Number($('offset').value) || 0;
  const practiceType = selection()?.practiceType || 'all';
  const accept = question => matchesPracticeQuestion(question,practiceType);
  history = []; sessionResults = new Map(); sessionId = crypto.randomUUID(); hitEffects = []; ghostPressTimes.fill(-Infinity);
  session=sessionPlan(playlist.duration);setMusicGain(1);
  const seed=crypto.getRandomValues(new Uint32Array(1))[0],epoch=Date.now();
  const createGame=(getHistory,getResults)=>{
    const random=seededRandom(seed),picker=createAdaptivePicker(makeQuestionQueue(filtered,random,accept),getHistory,random,getResults);
    return new (gameplayOptions.rhythm==='focus'?FocusGame:Game)(filtered,playlist.events,offsetMs/1000,random,session.endTime,accept,picker,session.fadeStart,RHYTHMS[gameplayOptions.rhythm].tapGoal,gameplayOptions);
  };
  let referenceHistory=structuredClone(learningHistory);const referenceResults=new Map();
  const reference=gameplayOptions.rhythm==='focus'?null:perfectReference(createGame(()=>referenceHistory,()=>referenceResults.values()),(q,index,time)=>{
    referenceHistory=recordAnswer(referenceHistory,q,{correct:true,chosen:q.answer,time:epoch+time*1000,attempt:'reference:'+index});
    referenceResults.set(index,{question:q,correct:true,wrong:0});
  });
  game=createGame(()=>learningHistory,()=>sessionResults.values());if(!game.focus)game.scorePlan=reference;game.refreshScore();
  const course = catalog.find(c => c.id === selection()?.id);
  sessionScope = {id:course.id, school:course.school, subject:course.subject, year:course.year, grade:`${course.school === '中学' ? '中' : '高'}${course.year}`};
  levelPrevious = null; updateLearningLevel();
  questionKey = ''; show('play'); render(); draw();
  try {
    $('instruction').textContent='楽曲を準備しています…';
    await prepareMusicAudio();
    if(musicContext){
      musicPlayer ||= new MusicPlayer(musicContext,musicGain);
      await musicPlayer.prepare(playlist);
      if(screen!=='play')return;
      if(document.hidden){interruptPlay();return;}
      musicPlayer.start(playlist,session.endTime);
    }else await audio.play();
    if (screen !== 'play') { musicPlayer?.stop();audio.pause(); return; }
    if (document.hidden) { interruptPlay(); return; }
    playedTracks.push(track);prepareTapAudio()?.catch(() => {});verifyTapAudioClock();loop();
  }
  catch { if (screen === 'play') { musicPlayer?.stop();audio.pause();suspendMusicAudio();show('home'); $('load-status').textContent = '音声を再生できませんでした。接続を確認して、もう一度開始してください。'; } }
  finally { busy = false; refreshStart(); }
}
function tuningRate() { return Number($('tuning-rate').value); }
function tuningBeats() { return track.events.map(event => event.time - track.start); }
function resetTuning(initialMs = effectiveOffset(timingSettings)) {
  tuningGeneration++; tuningStarting = false; audio.pause(); cancelAnimationFrame(frame);
  selectTrack(Number($('tuning-track').value),true); audio.currentTime = 0; audio.loop = true; audio.playbackRate = tuningRate();
  audio.preservesPitch = true;setMusicGain(1);
  tuningPattern = calibrationPattern(tuningBeats()); tuningPressTime = -Infinity;
  tuningSession = new TimingCalibrator(initialMs,true); tuningConsumed.clear(); tuningRound = 0; tuningLastTime = 0; tuningFeedback = ''; tuningMessage = 'ノーツに合わせてタップしてください。休みの間は押さず、次のノーツを待ちましょう。';
  $('tuning-play').disabled = false; renderTuning();
}
function renderTuning() {
  if (!tuningSession) return;
  const state = tuningSession.status(), rate = tuningRate();
  $('tuning-applied').textContent = signedMs(state.appliedMs);
  $('tuning-count').textContent = `${state.inliers} / 32`;
  $('tuning-spread').textContent = state.count ? `${Math.round(state.spreadMs)}ms` : '—';
  $('tuning-save').disabled = !state.ready || tuningStarting;
  $('tuning-normal').disabled = !state.ready || rate === 1 || tuningStarting;
  $('tuning-tap').disabled = audio.paused || tuningStarting;
  $('tuning-play').textContent = audio.paused ? (audio.currentTime ? '再開' : '開始') : '一時停止';
  $('tuning-status').textContent = tuningMessage || (state.ready ? `安定しました。推定 ${signedMs(state.estimateMs)}。保存するか、さらにタップして確認できます。` : state.count < 8 ? '最初は様子を見ています。曲の拍を聴いてタップしてください。' : `調整中。休み明けの確認 ${state.anchorCount} / 4回 · ${state.excluded}回の外れ値を除外。`);
  const near = tuningPattern.some(p=>Math.abs((audio.currentTime-p.base)/rate*1000-tuningSession.appliedMs)<500);
  $('tuning-tap').textContent = near ? 'ノーツに合わせてタップ' : '休み · 次のノーツを待とう';
  $('tuning-judgment').textContent = audio.currentTime - tuningFeedbackAt < .65 * rate ? tuningFeedback : '';
  drawTuning();
}
// A translucent receiver stays centered exactly on the judgment line.
function pressAmount(pressedAt, now, rate=1) {
  const elapsed=(now-pressedAt)/rate;
  return !reducedMotion.matches && elapsed>=0 && elapsed<.16 ? (1-elapsed/.16)**2 : 0;
}
function drawGhost(context, x, line, width, height, color, press=0) {
  context.save();
  context.fillStyle=color; context.strokeStyle=color;
  context.globalAlpha=.13;
  const w=width*(1+.1*press), h=height*(1+.25*press);
  context.beginPath();context.roundRect(x+(width-w)/2,line-h/2,w,h,5);context.fill();
  context.globalAlpha=.48;context.lineWidth=1.3;
  context.stroke();context.restore();
}
function drawHitFeedback(context, line, laneWidth, now) {
  hitEffects = hitEffects.filter(effect => now-effect.time < (effect.judgment==='PERFECT' ? .46 : .28));
  for(const effect of hitEffects){
    const perfect=effect.judgment==='PERFECT', duration=perfect ? .46 : .28;
    const progress=Math.max(0,(now-effect.time)/duration), fade=(1-progress)**2;
    const x=(effect.lane+.5)*laneWidth, radius=Math.min(52,laneWidth*.58);
    const color=perfect?'#ffe6a1':'#b8e7ff';
    context.save();
    context.beginPath();context.rect(effect.lane*laneWidth+2,Math.max(0,line-(perfect?38:52)),laneWidth-4,76);context.clip();
    const glow=context.createRadialGradient(x,line,0,x,line,radius);
    glow.addColorStop(0,perfect?'#ffe6a170':'#b8e7ff48');glow.addColorStop(1,'#ffffff00');
    context.globalAlpha=fade*(reducedMotion.matches ? .5 : 1);context.fillStyle=glow;
    context.fillRect(x-radius,line-radius,radius*2,radius*2);
    context.strokeStyle=color;context.shadowColor=color;context.shadowBlur=perfect?12:6;
    context.globalAlpha=fade*(perfect ? .85 : .55);context.lineWidth=perfect?1.8:1;
    const height=Math.min(20,Math.max(10,line*.22));
    context.beginPath();context.roundRect(effect.lane*laneWidth+8,line-height/2,laneWidth-16,height,5);context.stroke();
    if(!reducedMotion.matches){
      const count=perfect?8:3;
      for(let i=0;i<count;i++){
        const direction=(i/(count-1)-.5)*2;
        const angle=-Math.PI/2+i*Math.PI/4;
        const distance=Math.min(26,laneWidth*.32)*(.35+.65*progress);
        const px=perfect ? x+Math.cos(angle)*distance : x+direction*Math.min(laneWidth*.39,30)*(.35+.65*progress);
        const py=perfect ? line+Math.sin(angle)*distance : line-4-(1-Math.abs(direction)*.35)*(6+19*progress);
        const size=perfect?2.5+(i%2):1.8;
        context.globalAlpha=fade*(perfect ? .95 : .65);context.fillStyle=color;context.beginPath();
        if(perfect && i%2===0){
          context.moveTo(px,py-size*1.5);context.lineTo(px,py+size*1.5);
          context.moveTo(px-size,py);context.lineTo(px+size,py);context.stroke();
        }else{context.arc(px,py,size*(1-.35*progress),0,Math.PI*2);context.fill();}
      }
    }
    context.restore();
  }
}
function drawTuning() {
  const canvas = $('tuning-canvas'), ctx = canvas.getContext('2d'), rect = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width*dpr) || canvas.height !== Math.round(rect.height*dpr)) { canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr); }
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  const line = rect.height-28, now = audio.currentTime, rate = tuningRate();
  ctx.fillStyle = '#a8f07d18'; ctx.fillRect(0,line-10,rect.width,20);ctx.strokeStyle='#a8f07d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,line);ctx.lineTo(rect.width,line);ctx.stroke();
  drawGhost(ctx,rect.width*.18,line,rect.width*.64,14,'#e5edf7',pressAmount(tuningPressTime,now,rate));
  for (const {base:beat,anchor} of tuningPattern) {
    const target = beat + tuningSession.appliedMs/1000*rate, remaining = target-now;
    if (remaining>2.4*rate || remaining<-.4*rate) continue;
    const y = line*(1-remaining/(2.4*rate));
    ctx.fillStyle=anchor?'#a8f07d':'#eef5ff';ctx.shadowColor='#a8f07d';ctx.shadowBlur=8;ctx.beginPath();ctx.roundRect(rect.width*.18,y-7,rect.width*.64,14,5);ctx.fill();ctx.shadowBlur=0;
  }
}
function tuningLoop() {
  if (screen !== 'tuning') return;
  if (audio.currentTime < tuningLastTime-1) { tuningRound++;tuningConsumed.clear();tuningPressTime=-Infinity; }
  tuningLastTime = audio.currentTime; renderTuning();
  if (!audio.paused) frame = requestAnimationFrame(tuningLoop);
}
async function playTuning() {
  if (screen !== 'tuning' || tuningStarting) return;
  if (!audio.paused) { pauseTuning(); return; }
  prepareTapAudio(true)?.catch(() => {});
  const generation = tuningGeneration; tuningStarting = true; $('tuning-play').disabled = true;
  audio.playbackRate = tuningRate(); audio.loop = true;
  try {
    await Promise.all([prepareMusicAudio(),audio.play()]);
    if (screen !== 'tuning' || generation !== tuningGeneration) return;
    if (document.hidden) { pauseTuning(); return; }
    prepareTapAudio()?.catch(() => {}); verifyTapAudioClock();
    tuningMessage = ''; tuningStarting = false; tuningLoop();
  } catch { if (screen === 'tuning' && generation === tuningGeneration) {audio.pause();suspendMusicAudio();tuningMessage = '音楽を再生できません。開始を押して再試行してください。';} }
  finally { if (generation === tuningGeneration) { tuningStarting = false; $('tuning-play').disabled = false; renderTuning(); } }
}
function pauseTuning() {
  musicPlayer?.stop();audio.pause(); cancelAnimationFrame(frame); clearTimeout(tapAudioProbe); suspendMusicAudio();
  const context = tapAudio;
  if (context && context.state !== 'closed') context.suspend().catch(() => { if (tapAudio === context) tapAudioNeedsReset = true; });
  tuningMessage = '一時停止中。再開を押すと続けられます。'; renderTuning();
}
function tuningTap() {
  if (screen !== 'tuning' || audio.paused || tuningStarting) return;
  const now = audio.currentTime, match = matchCalibrationBeat(tuningBeats(),now,tuningRate(),tuningSession.appliedMs,tuningConsumed,tuningRound,tuningPattern);
  tuningFeedbackAt = now; tuningPressTime = now;
  playTapSound();
  if (!match) { tuningFeedback = '準備中・休み（計測対象外）'; renderTuning(); return; }
  tuningConsumed.add(match.id);
  const result = tuningSession.add(match.sampleMs,match.id,match.anchor);
  tuningMessage = '';
  tuningFeedback = result.accepted ? Math.abs(match.errorMs)<=80 ? 'PERFECT' : `${Math.round(Math.abs(match.errorMs))}ms ${match.errorMs>0?'遅め':'早め'}` : 'このタップは調整に使いません';
  renderTuning();
}
$('open-tuning').addEventListener('click', () => {
  if (!playlist || !outputConfirmed) return;
  audio.pause(); cancelAnimationFrame(frame); $('tuning-track').value = Math.max(0,tuningTracks.findIndex(song=>song.id===track?.id)); $('tuning-rate').value = '1'; show('tuning'); resetTuning();
});
$('tuning-play').addEventListener('click',playTuning);
for (const id of ['tuning-rate','tuning-track']) $(id).addEventListener('change',()=>resetTuning());
for (const id of ['tuning-tap','tuning-field']) $(id).addEventListener('pointerdown',event=>{event.preventDefault();tuningTap();});
$('tuning-normal').addEventListener('click',()=>{const initial=tuningSession.status().estimateMs;$('tuning-rate').value='1';resetTuning(initial);playTuning();});
$('tuning-save').addEventListener('click',()=>{
  const state = tuningSession.status(); if (!state.ready) return;
  pauseTuning();
  timingSettings.profiles[timingSettings.activeOutput] = {offsetMs:clampOffset(state.estimateMs),method:'calibrated',patternVersion:2,anchorCount:state.anchorCount,sampleCount:state.inliers,excluded:state.excluded,spreadMs:Math.round(state.spreadMs),playbackRate:tuningRate(),verifiedAtNormalSpeed:tuningRate()===1,trackId:track.id,measuredAt:new Date().toISOString(),baselineAtMeasurement:defaultTimingOffset(timingSettings.activeOutput)};
  tuningSession.appliedMs = clampOffset(state.estimateMs);
  const saved = persistTiming(); syncTimingUi();
  tuningMessage = `${signedMs(state.estimateMs)}を${saved?'保存しました。次回から適用します。':'今回のみ適用しました。ブラウザへ保存できませんでした。'}`;
  renderTuning(); openTimingReport();
  if (!saved) $('timing-copy-status').textContent = 'ブラウザへ保存できませんでした。今回のみ適用しています。設定値はコピーできます。';
});
$('tuning-back').addEventListener('click',()=>{tuningGeneration++;audio.pause();suspendMusicAudio();cancelAnimationFrame(frame);audio.loop=false;audio.playbackRate=1;show('home');});
function openTimingReport() {
  const report = timingReport(timingSettings); if (!report) return;
  $('timing-report-summary').textContent = `補正 ${signedMs(report.offsetMs)}／共通初期基準候補 ${signedMs(report.recommendedBaselineMs)} · ${report.verifiedAtNormalSpeed?'通常速度でも確認済み':report.method==='calibrated'?'スロー計測（通常速度は未確認）':'手動設定'}`;
  $('timing-report-text').value = JSON.stringify(report,null,2); $('timing-copy-status').textContent = ''; $('timing-report-dialog').showModal();
}
$('open-timing-report').addEventListener('click',openTimingReport);
$('close-timing-report').addEventListener('click',()=>$('timing-report-dialog').close());
$('copy-timing-report').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText($('timing-report-text').value); $('timing-copy-status').textContent='コピーしました。'; }
  catch { $('timing-report-text').focus();$('timing-report-text').select();$('timing-copy-status').textContent=document.execCommand('copy')?'コピーしました。':'選択した設定値をコピーしてください。'; }
});
function appendCharacters(element, text, start, segments = [{ text }], choice = false) {
  element.replaceChildren(); element.setAttribute('aria-label', text);
  let index = 0;
  for (const segment of segments) {
    const group = document.createElement('span');
    if (segment.state) {
      group.className = `blank-${segment.state}`; group.dataset.blankIndex = segment.index;
      characters.push({ choice, element: group, start: start + index * game.reveal.charSeconds });
    }
    element.append(group);
    for (const character of Array.from(segment.text)) {
      const span = document.createElement('span'); span.className = 'reveal-char';
      span.textContent = character; span.setAttribute('aria-hidden', 'true'); group.append(span);
      characters.push({ choice, element: span, start: start + index++ * game.reveal.charSeconds });
    }
  }
}
function renderKanji(puzzle, q, feedback = false) {
  const diagram = q?.diagram; puzzle.hidden = !diagram;
  const completed = !!diagram && feedback && q.blankPosition === q.blankTotal;
  puzzle.classList.toggle('completed', completed);
  if (diagram) {
    puzzle.replaceChildren();
    if (completed) puzzle.textContent = q.character;
    else for (const part of diagram.parts) {
      const solved = part.state === 'solved' || (part.state === 'active' && feedback);
      const piece = document.createElement('span'); piece.className = `kanji-piece ${solved ? 'solved' : part.state}`;
      piece.dataset.position = part.position;
      const [x,y,width,height] = part.box;
      Object.assign(piece.style, {left:`calc(${x}% + 2px)`,top:`calc(${y}% + 2px)`,width:`calc(${width}% - 4px)`,height:`calc(${height}% - 4px)`});
      const glyph = document.createElement('span'); glyph.textContent = solved ? part.answer : '？';
      if (solved) { const size = height * 0.80 * 0.88; glyph.style.fontSize = `${size}px`; glyph.style.transform = `scaleX(${Math.min(1,width*0.88/size)})`; }
      piece.append(glyph); puzzle.append(piece);
    }
    puzzle.setAttribute('aria-label', completed ? `完成：${q.character}` : `${q.targetLabel}。${diagram.parts.filter(part => part.state === 'solved').map(part => `${part.position}は${part.answer}`).join('、')}`);
  }
}
function renderQuestion() {
  const intro = ['intro', 'rhythm', 'outro'].includes(game.phase);
  const key = `${intro ? game.phase : 'question'}:${game.questionIndex}:${game.phase === 'feedback'}`;
  if (key === questionKey) return;
  questionKey = key; $('question-panel').scrollTop = 0; characters = []; choiceElements = []; $('choices').replaceChildren();
  const q = game.question;
  $('choices').classList.toggle('long-choices', !intro && choiceColumns(q) === 2);
  const segments = q.segments?.map(segment => game.phase === 'feedback' && segment.state === 'active' ? { ...segment, text: q.answer, state: 'solved' } : segment);
  const prompt = intro ? (game.phase === 'outro' ? '最後までリズムをつなごう' : game.phase === 'rhythm' ? 'リズムにのって、次の問題へ' : 'まずはリズムにのろう') : segments ? segments.map(s => s.text).join('') : q.prompt;
  appendCharacters($('prompt'), prompt, game.reveal.prompt.start, intro ? undefined : segments);
  $('question-task').textContent = intro || q.context ? '' : q.task;
  appendCharacters($('question-context'), intro || !q.context ? '' : q.task, game.reveal.context.start);
  $('blank-instruction').hidden = intro || !q.blankIndex;
  $('blank-instruction').textContent = game.phase === 'feedback' ? `正解：${q.answer}` : q.targetLabel || '';
  $('question-panel').classList.toggle('has-kanji', !intro && !!q.diagram);
  renderKanji($('kanji-puzzle'), intro ? null : q, game.phase === 'feedback');
  if (!intro) q.choices.forEach((choice, i) => {
    const el = document.createElement('div'); el.className = 'choice'; el.style.setProperty('--color', COLORS[i].value);
    el.classList.toggle('is-glyph', q.mode === 'kanji_component');
    const text = document.createElement('span'); appendCharacters(text, choice, game.reveal.choices[i].start, undefined, true); el.append(text);
    el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', choice);
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    choiceElements.push({ element: el, start: game.reveal.choices[i].start }); $('choices').append(el);
  });
}
function positionQuestion(elapsed) {
  const panel = $('question-panel');
  if(game.focus){panel.style.maxHeight=`${Math.max(100,$('play-stage').clientHeight-110)}px`;$('question-slot').style.height=`${panel.offsetHeight}px`;panel.style.transform='none';return;}
  panel.style.maxHeight = `${Math.max(100, $('play-stage').clientHeight - 112)}px`;
  // Reserve the final position, then place the same panel above the touch line.
  $('question-slot').style.height = `${panel.offsetHeight}px`;
  const stage = $('play-stage').getBoundingClientRect(), field = $('field').getBoundingClientRect();
  const lower = Math.max(0, field.bottom - stage.top - 72 - panel.offsetHeight);
  const progress = Math.max(0, Math.min(1, (elapsed - game.reveal.liftStart) / game.reveal.liftSeconds));
  const ease = progress * progress * (3 - 2 * progress);
  const lift = reducedMotion.matches ? (progress === 1 ? 1 : 0) : ease;
  panel.style.transform = `translate3d(0,${game.phase === 'read' && !game.reveal.continuation ? lower * (1 - lift) : 0}px,0)`;
}
function render() {
  $('total-score').textContent = game.totalScore.toLocaleString();
  $('time').textContent = `${formatTime(Math.max(0,Math.min(playbackTime(),session.endTime)))} / ${formatTime(session.endTime)}`;
  renderQuestion();
  const q = game.question, elapsed = game.time - game.phaseStart;
  $('play').classList.toggle('focus-mode',!!game.focus);
  $('focus-wait').hidden=!game.focus;
  if(game.focus)$('play').style.setProperty('--beat-pulse',reducedMotion.matches?0:game.pulse(game.time));
  $('play').dataset.phase = game.phase;
  $('play').dataset.continuation = game.reveal.continuation;
  $('field').setAttribute('aria-label', game.focus ? '回答結果とコンボ' : game.phase === 'answer' ? '4色のノーツ表示' : '白ノーツの表示');
  document.querySelectorAll('[data-lane]').forEach(button => { button.hidden = Number(button.dataset.lane) >= game.laneCount; button.disabled=!!game.focus&&game.phase!=='answer';button.setAttribute('aria-label',game.focus?`${COLORS[Number(button.dataset.lane)].name}の回答`:`左から${Number(button.dataset.lane)+1}番目のレーン`); button.style.setProperty('--lane-color', game.focus || game.phase === 'answer' ? COLORS[Number(button.dataset.lane)].value : '#dce7f5'); });
  document.querySelector('.play-hint').textContent = game.phase === 'read' || game.phase === 'feedback' ? '' : game.phase === 'answer' ? `4色が横一列に到着。答えの色だけを${game.requiredTaps}回タップ。` : '半透明のノーツに重なったら、そのレーンをタップ。';
  $('question-number').textContent = ['intro', 'rhythm', 'outro'].includes(game.phase) ? (game.focus?'拍に合わせてタップ':'白ノーツのレーンをタップ') : `Q ${game.questionIndex + 1} · ${q.grade} ${q.subject} / ${q.field}`;
  $('instruction').textContent = game.message;
  for (const character of characters) {
    const opacity = game.phase === 'read' && !game.reveal.instant && (!game.reveal.continuation || character.choice) ? Math.max(0, Math.min(1, (elapsed - character.start) / game.reveal.fadeSeconds)) : 1;
    character.element.style.opacity = reducedMotion.matches ? Number(opacity > 0) : opacity;
  }
  choiceElements.forEach(({element, start}, i) => {
    element.style.opacity = game.phase === 'read' && !game.reveal.instant ? Math.max(0, Math.min(1, (elapsed - start) / game.reveal.fadeSeconds)) : 1;
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
  $('tap-judgment').textContent = game.focus&&game.lastJudgment==='PERFECT'?'GREAT':game.lastJudgment;
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
  if(game.focus)return;
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
  for(let lane=0;lane<game.laneCount;lane++)drawGhost(ctx,lane*laneWidth+8,line,laneWidth-16,Math.min(20,Math.max(10,line*.22)),game.phase==='answer'?COLORS[lane].value:'#e5edf7',pressAmount(ghostPressTimes[lane],game.time));
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
  drawHitFeedback(ctx,line,laneWidth,game.time);
}
function loop() {
  if (!game || screen !== 'play') return;
  const now=playbackTime();
  if(musicPlayer){
    while(trackIndex+1<playlist.tracks.length && now>=playlist.tracks[trackIndex+1].start){
      track=playlist.tracks[++trackIndex];playedTracks.push(track);
      $('track-title').textContent=track.title;$('track-credit').textContent=`${trackIndex+1} / ${playlist.tracks.length} · ${track.creator}`;
    }
  }
  game.update(Math.min(now,session.endTime));setMusicGain(sessionGain(now,session));render();draw();
  if(now>=session.endTime){finish(true);return;}
  if (musicIsPlaying()) frame = requestAnimationFrame(loop);
}
function tap(lane) {
  if (screen !== 'play' || !musicIsPlaying() || busy || lane >= game.laneCount) return;
  if(playbackTime()>=session.endTime){finish(true);return;}
  const now=playbackTime();game.update(now);
  if(game.focus&&lane>=0&&game.phase!=='answer')return;
  const q = game.question, first = game.firstTry, previousCount = game.correctCount, previousWrong = game.wrongCount, occurrence = game.questionIndex;
  const shouldSound = game.focus || ['intro', 'answer', 'rhythm', 'outro'].includes(game.phase);
  if(lane>=0)ghostPressTimes[lane] = game.time;
  const note = game.tap(lane, now);
  if (!game.focus && note && ['GOOD','PERFECT'].includes(game.lastJudgment)) {
    hitEffects.push({lane,judgment:game.lastJudgment,time:game.time});
    if(hitEffects.length>24)hitEffects.shift();
  }
  if (shouldSound) playTapSound(false, note ? game.lastJudgment : 'MISS');
  if (game.correctCount > previousCount || game.wrongCount > previousWrong) {
    const result = sessionResults.get(occurrence) || {question:structuredClone(q), wrong:0, correct:false};
    const correct = game.correctCount > previousCount;
    saveAnswer(q, correct, q.choices[note.color], result.wrong);
    if (correct) result.correct = true; else result.wrong++;
    sessionResults.set(occurrence, result);
    if (correct) history.push({term:q.term, note:q.note, first, label:q.reviewLabel, answer:q.answer, wrong:result.wrong});
  }
  render(); draw();
}
$('focus-wait').addEventListener('pointerdown',event=>{event.preventDefault();tap(-1);});
document.querySelectorAll('[data-lane]').forEach(button => button.addEventListener('pointerdown', event => { event.preventDefault(); tap(Number(button.dataset.lane)); }));
// Prevent selection handles, long-press callouts and drag gestures while playing.
for (const type of ['selectstart', 'contextmenu', 'dragstart']) $('play').addEventListener(type, event => event.preventDefault());
let gestureY = 0;
document.addEventListener('touchstart', event => { gestureY = event.touches[0]?.clientY || 0; }, {passive:true});
function blockPageScroll(event, delta) {
  if (screen !== 'play' && screen !== 'tuning') return;
  if (event.target.closest?.('dialog[open]')) return;
  const panel = event.target.closest?.('#question-panel');
  const canScroll = panel && panel.scrollHeight > panel.clientHeight + 1 && (delta > 0 ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1 : panel.scrollTop > 0);
  if (!canScroll) event.preventDefault();
}
document.addEventListener('touchmove', event => {
  if (event.touches.length !== 1) return;
  const y = event.touches[0].clientY; blockPageScroll(event, gestureY - y); gestureY = y;
}, {passive:false});
document.addEventListener('wheel', event => blockPageScroll(event, event.deltaY), {passive:false});
document.addEventListener('keydown', event => {
  if (screen === 'tuning') {
    if (!$('timing-report-dialog').open && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && ['Space','KeyD','KeyF','KeyG','KeyH'].includes(event.code) && !['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); tuningTap(); }
    return;
  }
  if ($('controls-help').open || screen !== 'play' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.code)) event.preventDefault();
  const lane = ['KeyD','KeyF','KeyG','KeyH'].indexOf(event.code);
  if (lane >= 0) { event.preventDefault(); tap(lane); }
  if (event.code === 'Space') {event.preventDefault();if(game.focus)tap(-1);}
});
function interruptPlay(reason='画面の切替によりプレイを終了しました。ここまでの回答は記録済みです。') {
  if (screen === 'tuning') { pauseTuning(); return; }
  if (screen === 'play') finish(false,reason);
}
function renderBest(element, key, records) {
  element.replaceChildren();
  const value = document.createElement('span'); value.textContent = `自己ベスト ${records.best[key].toLocaleString()}`; element.append(value);
  if (records.updated[key]) { const badge = document.createElement('b'); badge.textContent = '自己ベスト更新'; element.append(badge); }
}
function finish(completed, reason=null) {
  if (screen !== 'play') return;
  musicPlayer?.stop();audio.pause(); cancelAnimationFrame(frame); clearTimeout(tapAudioProbe); suspendMusicAudio();
  const context = tapAudio;
  if (context && context.state !== 'closed') context.suspend().catch(() => {});
  if (completed) game.update(Math.min(playbackTime(),session.endTime));
  const unfinished = !['intro','feedback','rhythm','outro'].includes(game.phase) ? game.question.reviewLabel : null;
  const unfinishedWrong = sessionResults.get(game.questionIndex)?.wrong || 0;
  const awards = game.achievements(completed, !!unfinished);
  game.finish();
  clearTimeout(resultTimer); $('result-details').hidden = true; $('result-details').classList.remove('revealed');
  const records = updateBests(personalBests, {totalScore:game.totalScore, rhythmCombo:game.maxCombo, quizCombo:game.maxQuizCombo});
  personalBests = records.best;
  try { const legacy=normalizeBests(JSON.parse(localStorage.getItem(BEST_KEY)||'null'));localStorage.setItem(BEST_KEY,JSON.stringify({...personalBests,totalScore:legacy.totalScore}));localStorage.setItem(SCORE_BEST_KEY,String(personalBests.totalScore)); }
  catch { $('history-storage-note').hidden = false; }
  show('result');
  renderBest($('result-score-best'), 'totalScore', records);
  resultTimer = setTimeout(() => {
    if (screen !== 'result') return;
    $('result-details').hidden = false; $('result-details').classList.add('revealed'); resultTimer = undefined;
  }, 1200);
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
  $('result-reason').textContent = reason || (completed ? '最後までおつかれさま！' : 'ここまでの学習を記録しました。');
  $('result-music-list').replaceChildren();
  const seenMusic=new Set();
  for(const song of playedTracks){
    if(seenMusic.has(song.id))continue;seenMusic.add(song.id);
    const item=document.createElement('li'),title=document.createElement('strong'),credit=document.createElement('p');
    title.textContent=song.title;credit.textContent=musicCredit(song);item.append(title,credit);$('result-music-list').append(item);
  }
  $('result-music').hidden=!seenMusic.size;
  $('result-rhythm').textContent=RHYTHMS[game.options.rhythm].label;
  $('result-speed').textContent=SPEEDS[game.options.speed];
  $('result-stats').replaceChildren();
  $('result-total-score').textContent = game.totalScore.toLocaleString();
  const score=game.scoreBreakdown;
  const wrongAnswers=[...sessionResults.values()].filter(result=>result.wrong>0).length;
  const columns = [
    ['リズム', [
      ['最大リズムコンボ',game.maxCombo,'rhythmCombo'],
      [game.focus?'GREAT':'PERFECT',`${game.judgments.PERFECT}回`],['GOOD',`${game.judgments.GOOD}回`],
      [game.focus?'待機リズム得点':'白ノーツ得点',score.netWhite.toLocaleString()],['コンボボーナス',(score.whiteBonus+score.colorBonus).toLocaleString()],
      [game.focus?'見逃しMISS':'ノーツMISS',`${game.missedNotes}回`],['空振りMISS',`${game.emptyMisses}回`]
    ]],
    ['学習', [
      ['最大一発正解コンボ',game.maxQuizCombo,'quizCombo'],
      ['一発回答数',`${game.firstCount}回`],['誤答が発生した回答数',`${wrongAnswers}回`],
      ['正答得点',score.baseAnswer.toLocaleString()],['正解コンボボーナス',score.answerBonus.toLocaleString()],['カラー得点',score.netColor.toLocaleString()],
      ['お手つき回数',`${game.wrongCount}回`]
    ]]
  ];
  for (const [title, entries] of columns) {
    const column = document.createElement('section'), heading = document.createElement('h2');
    column.className = 'result-column'; column.setAttribute('aria-label', `${title}の成績`);
    heading.textContent = title; column.append(heading);
    for (const [label, value, bestKey] of entries) {
      const div = document.createElement('div'), strong = document.createElement('strong');
      div.textContent = label; strong.textContent = value; div.append(strong);
      if (bestKey) { const badge = document.createElement('span'); badge.className = 'personal-best'; renderBest(badge, bestKey, records); div.append(badge); }
      column.append(div);
    }
    $('result-stats').append(column);
  }
  reviewQuestions = missedQuestions([...sessionResults.values()]);
  $('start-review').disabled = !reviewQuestions.length;
  $('review-availability').textContent = reviewQuestions.length ? `${reviewQuestions.length}問を音楽なしで復習できます。` : '今回は間違えた問題がありません。';
  $('review').replaceChildren();
  for (const item of history) { const li = document.createElement('li'); li.textContent = `${item.first ? '一発正解' : '再挑戦で正解'} · ${item.label} — 正解：${item.answer} · お手付き${item.wrong}回 · ${item.note}`; $('review').append(li); }
  if (unfinished) { const li = document.createElement('li'); li.textContent = `未回答 · ${unfinished}（正答数には含みません）· お手付き${unfinishedWrong}回`; $('review').append(li); }
  if (!history.length && !unfinished) { const li = document.createElement('li'); li.textContent = '今回はリズムプレイのみでした。'; $('review').append(li); }
}
function renderPractice() {
  const q = reviewQuestions[reviewIndex];
  $('practice-progress').textContent = q ? `${reviewIndex + 1} / ${reviewQuestions.length} · ${q.grade} ${q.subject}` : 'すべての問題を正解できました。';
  $('practice-task').textContent = q?.task || '';
  $('practice-target').textContent = q?.targetLabel || '';
  $('practice-prompt').replaceChildren(); $('practice-choices').replaceChildren();
  $('practice-feedback').textContent = q ? '' : '○ 復習完了！'; $('practice-explanation').textContent = '';
  $('practice-next').hidden = !q; $('practice-next').disabled = true;
  renderKanji($('practice-kanji'), q);
  if (!q) return;
  for (const segment of q.segments || [{text:q.prompt}]) {
    const span = document.createElement('span'); span.textContent = segment.text;
    if (segment.state) span.className = `blank-${segment.state}`;
    $('practice-prompt').append(span);
  }
  q.choices.forEach((choice, index) => {
    const button = document.createElement('button'); button.className = 'practice-answer'; button.textContent = choice;
    button.addEventListener('click', () => {
      if (reviewSolved) return;
      const correct = index === q.correct;
      saveAnswer(q, correct, choice, reviewWrong, 'review');
      $('practice-feedback').textContent = correct ? '○ 正解！' : '✖ もう一度';
      $('practice-feedback').dataset.result = correct ? 'correct' : 'wrong';
      if (!correct) { reviewWrong++; return; }
      reviewSolved = true;
      for (const answer of $('practice-choices').children) answer.disabled = true;
      button.classList.add('correct');
      const source = questions.find(item => item.id === q.sourceId);
      const explanation = (q.variant ? q.note : source?.note || q.note) || '正しい語句を確認して、次の問題へ進もう。';
      $('practice-explanation').textContent = `正解：${q.answer}。${explanation}`;
      if (q.segments) for (const span of $('practice-prompt').querySelectorAll('.blank-active')) { span.textContent = q.answer; span.className = 'blank-solved'; }
      renderKanji($('practice-kanji'), q, true);
      $('practice-next').disabled = false;
    });
    $('practice-choices').append(button);
  });
}
$('start-review').addEventListener('click', () => {
  if (!reviewQuestions.length) return;
  audio.pause(); cancelAnimationFrame(frame); reviewRun = crypto.randomUUID(); reviewIndex = 0; reviewSolved = false; reviewWrong = 0;
  show('practice-review'); renderPractice();
});
$('practice-next').addEventListener('click', () => {
  if (!reviewSolved) return;
  reviewIndex++; reviewSolved = false; reviewWrong = 0; renderPractice(); window.scrollTo(0,0);
});
$('practice-back').addEventListener('click', () => show('result'));
$('help').addEventListener('click', () => { if (screen === 'home') $('controls-help').showModal(); });
$('close-help').addEventListener('click', () => $('controls-help').close());
$('start').addEventListener('click', start); $('again').addEventListener('click', start);
for(const id of ['back','back-bottom'])$(id).addEventListener('click', () => show('home'));
$('quit').addEventListener('click', () => finish(false));
audio.addEventListener('ended', async () => {
  if (screen !== 'play' || busy || musicPlayer) return;
  if (playbackTime()>=session.endTime || trackIndex + 1 >= playlist.tracks.length) { finish(true); return; }
  busy = true; cancelAnimationFrame(frame);
  selectTrack(trackIndex + 1);
  try {
    if (document.hidden) { interruptPlay(); return; }
    await Promise.all([prepareMusicAudio(),audio.play()]);
    prepareTapAudio()?.catch(() => {}); verifyTapAudioClock();
    if (screen !== 'play') { audio.pause(); return; }
    if (document.hidden) { interruptPlay(); return; }
    playedTracks.push(track);game.update(playbackTime());render();draw();loop();
  } catch {
    if (screen === 'play') interruptPlay('次の曲を再生できなかったため終了しました。ここまでの回答は記録済みです。');
  } finally { busy = false; }
});
audio.addEventListener('error', () => { if (screen === 'tuning') { pauseTuning(); tuningMessage='音楽を読み込めません。接続を確認してください。';renderTuning(); } if (screen === 'play') interruptPlay('音声を読み込めなかったため終了しました。ここまでの回答は記録済みです。'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { tapAudioNeedsReset = true; interruptPlay(); }
  else if(screen==='play')screenWakeLock.acquire();
});
window.addEventListener('pagehide', () => { screenWakeLock.setEnabled(false);tapAudioNeedsReset = true; interruptPlay(); });
window.addEventListener('blur', () => { tapAudioNeedsReset = true; if (screen === 'play') interruptPlay(); });
for (const type of ['pause','waiting']) audio.addEventListener(type, () => {
  if (screen === 'play' && !musicPlayer && !busy && !audio.ended) interruptPlay('音楽が中断されたためプレイを終了しました。ここまでの回答は記録済みです。');
});
window.addEventListener('resize', () => { if (screen === 'play') { render(); draw();requestAnimationFrame(capturePlayLayout); } else if (screen === 'tuning') renderTuning(); });
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
        $('update-status').textContent = '最新版への切替を確認中です。少し待ってから「最新版を読み込む」をお試しください。'; return;
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

$('audio-output-dialog').addEventListener('cancel', event => event.preventDefault());
for (const button of document.querySelectorAll('[data-output-choice]')) {
  button.setAttribute('aria-pressed', String(button.dataset.outputChoice === timingSettings.activeOutput));
  button.addEventListener('click', () => {
    selectTimingOutput(button.dataset.outputChoice); outputConfirmed = true;
    $('audio-output-dialog').close(); refreshStart(); $('open-tuning').disabled = !playlist;
  });
}
$('audio-output-dialog').showModal();
