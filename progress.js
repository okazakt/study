// Local learning history. Practice and music-play records stay distinct.
export const HISTORY_KEY = 'study-beat-history-v1';
export const questionKey = q => JSON.stringify([q.sourceId || q.id, q.mode, q.blankIndex || 0]);
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export function normalizeHistory(raw) {
  if (raw?.version !== 1) return {version:1, questions:{}, events:[]};
  const questions = Object.fromEntries(Object.entries(raw.questions || {}).filter(([,q])=>q && typeof q==='object').map(([key,q])=>[key,{...q,correct:count(q.correct),wrong:count(q.wrong),first:count(q.first),reviewCorrect:count(q.reviewCorrect),reviewWrong:count(q.reviewWrong)}]));
  const events = (Array.isArray(raw.events) ? raw.events : []).filter(e=>e && typeof e.key==='string' && typeof e.correct==='boolean' && ['play','review'].includes(e.kind) && typeof e.subject==='string' && typeof e.grade==='string').slice(-10000);
  return {version:1,questions,events};
}
export function recordAnswer(state, q, {correct, chosen, wrongBefore=0, kind='play', session='', course='', time=Date.now(), version=''}={}) {
  const key=questionKey(q), old=state.questions[key] || {correct:0,wrong:0,first:0,reviewCorrect:0,reviewWrong:0};
  const meta={key,sourceId:q.sourceId || q.id,mode:q.mode,blankIndex:q.blankIndex || 0,school:q.school_level,subject:q.subject,grade:q.grade,label:q.reviewLabel,answer:q.answer};
  const entry={...old,...meta,lastAt:time};
  if(kind==='review') entry[correct?'reviewCorrect':'reviewWrong']++;
  else {entry[correct?'correct':'wrong']++;if(correct && !wrongBefore)entry.first++;}
  const event={...meta,correct:!!correct,chosen,wrongBefore,kind,session,course,time,version};
  return {version:1,questions:{...state.questions,[key]:entry},events:[...state.events,event].slice(-10000)};
}
export function learningLevel(state, scope) {
  const events=state.events.filter(e=>e.kind==='play' && e.school===scope?.school && e.subject===scope?.subject && (scope?.year==='exam' || e.grade===scope?.grade)).slice(-100);
  const distinct=new Set(events.map(e=>e.key)).size;
  return {count:events.length,distinct,value:events.length>=30 && distinct>=10 ? Math.round(1000*(events.filter(e=>e.correct).length+2)/(events.length+4))/10 : null};
}
export function missedQuestions(results) {
  const seen=new Set();
  return results.filter(result=>{
    const key=questionKey(result.question);
    if(!result.wrong || seen.has(key))return false;
    seen.add(key);return true;
  }).map(result=>result.question);
}

export const BEST_KEY = 'study-beat-bests-v1';
export function normalizeBests(raw) {
  return {totalScore:count(raw?.totalScore),rhythmCombo:count(raw?.rhythmCombo),quizCombo:count(raw?.quizCombo)};
}
export function updateBests(previous, current) {
  const best = normalizeBests(previous), values = normalizeBests(current), updated = {};
  for (const key of Object.keys(best)) { updated[key] = values[key] > best[key]; best[key] = Math.max(best[key], values[key]); }
  return {best, updated};
}
