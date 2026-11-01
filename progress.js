import { materializeChoiceItem, normalizePatternUsage } from './choice-variants.js?v=0.62.0';
import { materializeMathItem } from './math-variants.js?v=0.62.0';
// Local learning history. Practice and music-play records stay distinct.
export const HISTORY_KEY = 'study-beat-history-v1';
export const questionKey = q => JSON.stringify([q.sourceId || q.id, q.mode, q.blankIndex || 0]);
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
// Recover one row per question occurrence, including older retry records that
// predate stable attempt IDs. Missing old details remain explicitly unknown.
function eventAttempts(events) {
  const grouped=new Map(), identities=new Map();
  for(const [i,event] of events.entries()){
    const rows=grouped.get(event.key) || [], last=rows.at(-1);
    const byId=identities.get(event.key) || new Map();
    let row=event.attempt ? byId.get(event.attempt) : null;
    if(!event.attempt && last && !last.solved && last.kind===event.kind && last.session===(event.session || '') && event.wrongBefore!==0 && !(event.correct && !event.wrongBefore))row=last;
    if(!row){row={attempt:event.attempt || `legacy:${event.key}:${i}`,correct:true,solved:false,wrongCount:0,kind:event.kind,session:event.session || ''};rows.push(row);byId.set(row.attempt,row);}
    if(!event.attempt && !Number.isSafeInteger(event.wrongBefore))row.uncertain=true;
    row.correct &&= event.correct && !event.wrongBefore;
    row.solved=event.correct;row.wrongCount=Math.max(row.wrongCount+(event.correct?0:1),count(event.wrongBefore)+(event.correct?0:1));
    row.chosen=event.chosen ?? null;row.time=Number.isFinite(event.time)?event.time:null;
    if(event.variant){row.variant=event.variant;row.presentation=event.presentation;}
    grouped.set(event.key,rows);identities.set(event.key,byId);
  }
  return grouped;
}
function recentResult(row, recovered=null){
  const source=recovered ? {...row,...recovered,correct:row.correct && recovered.correct} : row;
  const correct=!!source.correct;
  const solved=typeof source.solved==='boolean'?source.solved:correct?true:null;
  const wrongCount=Math.max(count(source.wrongCount),correct?0:1);
  return {attempt:source.attempt,correct,solved,wrongCount,chosen:source.chosen ?? null,time:Number.isFinite(source.time)?source.time:null,kind:['play','review'].includes(source.kind)?source.kind:null,
    ...(source.variant?{variant:source.variant,presentation:source.presentation}:{})};
}
export function normalizeHistory(raw) {
  if (raw?.version !== 1) return {version:1, questions:{}, events:[]};
  const events = (Array.isArray(raw.events) ? raw.events : []).filter(e=>e && typeof e.key==='string' && typeof e.correct==='boolean' && ['play','review'].includes(e.kind) && typeof e.subject==='string' && typeof e.grade==='string').slice(-10000);
  const recovered=eventAttempts(events);
  const questions=Object.fromEntries(Object.entries(raw.questions || {}).filter(([,q])=>q && typeof q==='object').map(([key,q])=>{
    const row={...q,correct:count(q.correct),wrong:count(q.wrong),first:count(q.first),reviewCorrect:count(q.reviewCorrect),reviewWrong:count(q.reviewWrong)};
    const attempts=recovered.get(key) || [], byId=new Map(attempts.map(a=>[a.attempt,a]));
    const recent=Array.isArray(q.recent)?q.recent.filter(r=>r && typeof r.attempt==='string' && typeof r.correct==='boolean').slice(-3):[];
    const tail=attempts.slice(-recent.length);
    const legacyAligned=recent.length>0 && tail.length===recent.length && recent.every((r,i)=>r.attempt.startsWith('legacy:') && r.correct===tail[i].correct);
    row.recent=recent.length?recent.map((r,i)=>recentResult(r,byId.get(r.attempt) || (legacyAligned?tail[i]:null))):attempts.slice(-3).map(r=>recentResult(r));
    const completed=row.correct+row.reviewCorrect;
    const confirmedFloor=Math.max(row.correct,row.wrong>0?1:0)+Math.max(row.reviewCorrect,row.reviewWrong>0?1:0);
    const lowerBound=Math.max(confirmedFloor,completed+attempts.filter(a=>!a.solved).length,attempts.length,row.recent.length);
    row.answerCount=Math.max(count(q.answerCount),lowerBound);
    row.answerCountEstimated=typeof q.answerCountEstimated==='boolean'?q.answerCountEstimated:!(!attempts.some(a=>a.uncertain) && attempts.filter(a=>a.solved).length===completed && attempts.reduce((n,a)=>n+a.wrongCount,0)===row.wrong+row.reviewWrong);
    row.patternUsage=normalizePatternUsage(q.patternUsage);
    row.lastAt=Math.max(Number.isFinite(q.lastAt)?q.lastAt:0,...attempts.map(a=>a.time ?? 0));
    return [key,row];
  }));
  return {version:1, questions, events};
}
export function recordAnswer(state, q, {correct, chosen, wrongBefore=0, kind='play', session='', course='', time=Date.now(), version='', attempt=''}={}) {
  const key=questionKey(q);
  let old=state.questions[key] || {correct:0,wrong:0,first:0,reviewCorrect:0,reviewWrong:0,answerCount:0,answerCountEstimated:false,recent:[]};
  if(!Number.isSafeInteger(old.answerCount))old=normalizeHistory(state).questions[key];
  const snapshot=q.variant?{
    variant:{...q.variant,parameters:{...q.variant.parameters}},
    presentation:{prompt:q.prompt,choices:[...q.choices],note:q.note}
  }:{};
  const meta={key,sourceId:q.sourceId || q.id,mode:q.mode,blankIndex:q.blankIndex || 0,school:q.school_level,subject:q.subject,grade:q.grade,label:q.reviewLabel,answer:q.answer,...(q.textbook?{textbook:{...q.textbook}}:{}),...snapshot};
  const entry={...old,...meta,lastAt:time};
  const attemptId = attempt || `${session}:${kind}:${time}:${old.correct+old.wrong+old.reviewCorrect+old.reviewWrong}`;
  const previousRecent=old.recent?.length?old.recent:(eventAttempts(state.events).get(key) || []).slice(-3).map(r=>recentResult(r));
  const recent=previousRecent.map(r=>({...r})),previous=recent.at(-1)?.attempt===attemptId?recent.at(-1):null;
  const result={attempt:attemptId,correct:(previous?.correct ?? true) && !!correct && !wrongBefore,solved:!!correct,wrongCount:Math.max(count(previous?.wrongCount)+(correct?0:1),wrongBefore+(correct?0:1)),chosen:chosen ?? null,time,kind,...snapshot};
  if(previous)recent[recent.length-1]=result;else recent.push(result);
  entry.answerCount=count(old.answerCount)+(previous?0:1);
  entry.recent=recent.slice(-3);
  if(q.variant?.generator==='choice_text'){
    const usage=normalizePatternUsage(old.patternUsage);
    // Before presentation tracking existed, every occurrence used the base text.
    if(!Object.keys(usage).length && count(old.answerCount))usage.base={count:count(old.answerCount),lastAt:old.lastAt || 0};
    const pattern=q.variant.parameters.pattern,prior=usage[pattern] || {count:0,lastAt:0};
    usage[pattern]={count:prior.count+(previous?0:1),lastAt:time};entry.patternUsage=usage;
  }
  if(kind==='review') entry[correct?'reviewCorrect':'reviewWrong']++;
  else {entry[correct?'correct':'wrong']++;if(correct && result.correct)entry.first++;}
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
export const SCORE_BEST_KEY = 'study-beat-score-best-v3';
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
  const reverse = new Map(), recent = new Map([...eventAttempts(state.events)].map(([key,rows])=>[key,rows.slice(-3).map(r=>recentResult(r))]));
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
function selectionRank(q,index){
  const key=questionKey(q),row=index.state.questions[key],recent=row?.recent?.length?row.recent:index.recent.get(key) || [];
  let failures=0;for(let i=recent.length-1;i>=0 && !recent[i].correct;i--)failures++;
  return [-failures,count(row?.answerCount),Number.isFinite(row?.lastAt)?row.lastAt:0];
}
const compareRank=(a,b)=>a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
function unitRank(unit,category,index){
  return unit.filter(q=>priorityCategory(q,index)===category).map(q=>selectionRank(q,index)).sort(compareRank)[0];
}
export function createAdaptivePicker(questions, getHistory, random=Math.random, getSessionResults=null) {
  const units=[];
  for(const q of questions){
    const previous=units.at(-1);
    if(q.continuation && previous && previous[0].sourceId===q.sourceId && previous[0].mode===q.mode)previous.push(q);
    else units.push([q]);
  }
  const recentSources=[], seen=new Set(), lastVariants=new Map();
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
    const ranked=groups[category].map(unit=>({unit,rank:unitRank(unit,category+1,index)}));
    const best=ranked.reduce((a,b)=>compareRank(a.rank,b.rank)<=0?a:b).rank;
    const tied=ranked.filter(candidate=>compareRank(candidate.rank,best)===0);
    const unit=tied[Math.floor(random()*tied.length)].unit;
    if(getSessionResults)for(const q of unit)seen.add(questionKey(q));
    recentSources.push(unit[0].sourceId);if(recentSources.length>3)recentSources.shift();
    // Keep stable identities but shuffle the color positions on every appearance.
    return unit.map(q=>{
      if(q.numeric_generator || q.presentations?.length){
        const key=questionKey(q),previous=lastVariants.get(key)||index.state.questions[key]?.variant?.signature;
        if(q.numeric_generator)q=materializeMathItem(q,random,previous);
        else {
          const row=index.state.questions[key],usage=normalizePatternUsage(row?.patternUsage);
          if(!Object.keys(usage).length && count(row?.answerCount))usage.base={count:row.answerCount,lastAt:row.lastAt || 0};
          q=materializeChoiceItem(q,random,usage,previous);
        }
        q={...q,term:q.prompt,reviewLabel:q.prompt};
        lastVariants.set(key,q.variant.signature);
      }
      const choices=(q.numeric_generator || q.presentations?.length)?[q.answer,...q.dummies]:[...q.choices];
      for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
      return {...q,choices,correct:choices.indexOf(q.answer)};
    });
  };
}
