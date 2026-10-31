// Local learning history. Practice and music-play records stay distinct.
export const HISTORY_KEY = 'study-beat-history-v1';
export const questionKey = q => JSON.stringify([q.sourceId || q.id, q.mode, q.blankIndex || 0]);
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export function normalizeHistory(raw) {
  if (raw?.version !== 1) return {version:1, questions:{}, events:[]};
  const questions = Object.fromEntries(Object.entries(raw.questions || {}).filter(([,q])=>q && typeof q==='object').map(([key,q])=>[key,{...q,correct:count(q.correct),wrong:count(q.wrong),first:count(q.first),reviewCorrect:count(q.reviewCorrect),reviewWrong:count(q.reviewWrong),recent:Array.isArray(q.recent)?q.recent.filter(r=>r && typeof r.attempt==='string' && typeof r.correct==='boolean').slice(-3):[]}]));
  const events = (Array.isArray(raw.events) ? raw.events : []).filter(e=>e && typeof e.key==='string' && typeof e.correct==='boolean' && ['play','review'].includes(e.kind) && typeof e.subject==='string' && typeof e.grade==='string').slice(-10000);
  return {version:1,questions,events};
}
export function recordAnswer(state, q, {correct, chosen, wrongBefore=0, kind='play', session='', course='', time=Date.now(), version='', attempt=''}={}) {
  const key=questionKey(q), old=state.questions[key] || {correct:0,wrong:0,first:0,reviewCorrect:0,reviewWrong:0};
  const meta={key,sourceId:q.sourceId || q.id,mode:q.mode,blankIndex:q.blankIndex || 0,school:q.school_level,subject:q.subject,grade:q.grade,label:q.reviewLabel,answer:q.answer};
  const entry={...old,...meta,lastAt:time};
  if(kind==='review') entry[correct?'reviewCorrect':'reviewWrong']++;
  else {entry[correct?'correct':'wrong']++;if(correct && !wrongBefore)entry.first++;}
  const attemptId = attempt || `${session}:${kind}:${time}:${old.correct+old.wrong+old.reviewCorrect+old.reviewWrong}`;
  const previousRecent = old.recent?.length ? old.recent : buildPriorityIndex(state).recent.get(key) || [];
  const recent = previousRecent.map((r,i)=>({...r,attempt:r.attempt || `legacy:${key}:${time}:${i}`}));
  if (recent.at(-1)?.attempt === attemptId) recent[recent.length-1] = {attempt:attemptId,correct:recent.at(-1).correct && !!correct && !wrongBefore};
  else recent.push({attempt:attemptId,correct:!!correct && !wrongBefore});
  entry.recent = recent.slice(-3);
  const event={...meta,correct:!!correct,chosen,wrongBefore,kind,session,course,time,version,attempt:attemptId};
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

export const PRIORITY_WEIGHTS = [35,25,18,15,5,2];
const inverseModes = {explanation_to_term:'term_to_explanation',term_to_explanation:'explanation_to_term',to_english:'to_japanese',to_japanese:'to_english',japanese_term:'japanese_definition',japanese_definition:'japanese_term',kanji_reading:'kanji_component',kanji_component:'kanji_reading'};
const answered = row => !!row && ['correct','wrong','reviewCorrect','reviewWrong'].some(key=>count(row[key])>0);
export function buildPriorityIndex(state) {
  const reverse = new Map(), recent = new Map(), pending = new Set();
  // Reconstruct older histories that predate per-attempt identifiers.
  for (const event of state.events) {
    const rows = recent.get(event.key) || [];
    if(event.attempt){
      if(rows.at(-1)?.attempt===event.attempt) rows[rows.length-1].correct &&= event.correct && !event.wrongBefore;
      else rows.push({attempt:event.attempt,correct:event.correct && !event.wrongBefore});
    } else if (!event.correct) {
      if(!pending.has(event.key))rows.push({correct:false});
      pending.add(event.key);
    } else {
      if(!pending.has(event.key) || !event.wrongBefore)rows.push({correct:!event.wrongBefore});
      pending.delete(event.key);
    }
    recent.set(event.key,rows.slice(-3));
  }
  for(const row of Object.values(state.questions)) {
    if(!answered(row))continue;
    const key=JSON.stringify([row.sourceId,row.mode]), previous=reverse.get(key)||{correct:0,wrong:0};
    previous.correct+=count(row.correct)+count(row.reviewCorrect);previous.wrong+=count(row.wrong)+count(row.reviewWrong);reverse.set(key,previous);
  }
  return {state,reverse,recent};
}
export function priorityCategory(q, index) {
  const key=questionKey(q), own=index.state.questions[key];
  if(!answered(own)) {
    const opposite=inverseModes[q.mode] ? index.reverse.get(JSON.stringify([q.sourceId || q.id,inverseModes[q.mode]])) : null;
    return opposite?.wrong ? 2 : opposite?.correct ? 3 : 1;
  }
  const recent=own.recent?.length ? own.recent : index.recent.get(key) || [];
  if(recent.length>=3 && recent.every(r=>r.correct))return 6;
  return count(own.wrong) + count(own.reviewWrong) > 0 ? 4 : 5;
}
export function questionCoverage(questions, state) {
  const keys=new Set(questions.map(questionKey));
  return {total:keys.size,solved:[...keys].filter(key=>answered(state.questions[key])).length};
}
export function createAdaptivePicker(questions, getHistory, random=Math.random, getSessionResults=null) {
  const units=[];
  for(const q of questions){
    const previous=units.at(-1);
    if(q.continuation && previous && previous[0].sourceId===q.sourceId && previous[0].mode===q.mode)previous.push(q);
    else units.push([q]);
  }
  const recentSources=[], seen=new Set();
  return () => {
    if(!units.length)throw new Error('No question candidates');
    // Session filtering precedes the topic cooldown: a fresh reverse question
    // must win over repeating a different topic merely to preserve spacing.
    let pool=units;
    if(getSessionResults){
      const directions=new Map();
      for(const {question:q,correct,wrong} of getSessionResults()){
        const key=JSON.stringify([q.sourceId || q.id,q.mode]);
        const status=directions.get(key) || {correct:false,wrong:false};
        status.correct ||= !!correct; status.wrong ||= wrong>0;
        directions.set(key,status);
      }
      const fresh=units.filter(unit=>!unit.some(q=>{
        if(seen.has(questionKey(q)))return true;
        const reverse=inverseModes[q.mode] && directions.get(JSON.stringify([q.sourceId || q.id,inverseModes[q.mode]]));
        return reverse?.correct && !reverse.wrong;
      }));
      if(fresh.length)pool=fresh;
    }
    let candidates=[], cooldown=Math.min(3,recentSources.length);
    while(!candidates.length){
      const blocked=new Set(cooldown ? recentSources.slice(-cooldown):[]);
      candidates=pool.filter(unit=>!blocked.has(unit[0].sourceId));
      if(!cooldown)break;
      cooldown--;
    }
    const index=buildPriorityIndex(getHistory());
    const groups=Array.from({length:6},()=>[]);
    for(const unit of candidates)groups[Math.min(...unit.map(q=>priorityCategory(q,index)))-1].push(unit);
    const available=groups.map((group,i)=>group.length?PRIORITY_WEIGHTS[i]:0),total=available.reduce((a,b)=>a+b,0);
    let target=random()*total, category=available.findLastIndex(weight=>weight>0);
    for(let i=0;i<available.length;i++){target-=available[i];if(target<0){category=i;break;}}
    const group=groups[category], unit=group[Math.floor(random()*group.length)];
    if(getSessionResults)for(const q of unit)seen.add(questionKey(q));
    recentSources.push(unit[0].sourceId);if(recentSources.length>3)recentSources.shift();
    // Keep stable identities but shuffle the color positions on every appearance.
    return unit.map(q=>{
      const choices=[...q.choices];
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      return {...q,choices,correct:choices.indexOf(q.answer)};
    });
  };
}
