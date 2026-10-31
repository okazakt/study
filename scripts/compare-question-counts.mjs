// Compare short and long reading workloads with the real five-minute controller.
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,revealPlan} from '../game.js';
import {questionKey} from '../progress.js';
import {simulateSession} from './simulate-session.mjs';
import {practiceTypes,matchesPracticeQuestion} from '../learning.js';
const read=name=>JSON.parse(readFileSync(new URL('../quiz-data/junior_'+name+'.json',import.meta.url)));
function summarize(items,acceptQuestion=()=>true){
 const results=Array.from({length:100},(_,i)=>simulateSession(items,i+1,0,{acceptQuestion}).answers);
 return {average:Math.round(results.reduce((n,v)=>n+v,0)/results.length*10)/10,min:Math.min(...results),max:Math.max(...results)};
}
const workloads=[];
for(const [subject,file] of [['国語','japanese'],['英語','english'],['数学','math'],['理科','science'],['社会','social']]){
 const items=read(file),units=[];
 for(const q of makeQuestionQueue(items,()=>.5)){
  const last=units.at(-1);
  if(q.continuation && last && last[0].sourceId===q.sourceId && last[0].mode===q.mode)last.push(q);else units.push([q]);
 }
 units.sort((a,b)=>a.reduce((n,q)=>n+revealPlan(q).duration,0)/a.length-b.reduce((n,q)=>n+revealPlan(q).duration,0)/b.length);
 const count=Math.max(1,Math.ceil(units.length/4)),short=new Set(units.slice(0,count).flat().map(questionKey)),long=new Set(units.slice(-count).flat().map(questionKey));
 workloads.push({subject,all:summarize(items),short:summarize(items,q=>short.has(questionKey(q))),long:summarize(items,q=>long.has(questionKey(q)))});
}
const formats=[];
for(const [subject,file] of [['国語','japanese'],['英語','english']])for(const type of practiceTypes(subject))if(type.id!=='all')formats.push({subject,type:type.label,...summarize(read(file),q=>matchesPracticeQuestion(q,type.id))});
console.log(JSON.stringify({runsPerGroup:100,counting:'each blank, spelling segment, or kanji component counts as one answer stage',workloads,formats},null,2));
