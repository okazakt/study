// Authoring-only JSON/content guard. No browser, playback, session simulation or test suite.
import {readFileSync} from 'node:fs';
import {makeQuestionQueue,makeChoiceQuestion} from '../game.js';
import {choicePresentations} from '../choice-variants.js';
import {choiceColumns} from '../learning.js';
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
if(!args.includes('--file'))throw new Error('Usage: node scripts/check-content-budget.mjs --file <JSON> [--batch <content_batch>]');
const bank=JSON.parse(readFileSync(value('--file'),'utf8'));
if(!Array.isArray(bank))throw new Error('Question bank must be an array');
const budget=JSON.parse(readFileSync(new URL('../docs/content/content-budget.json',import.meta.url)));
const items=args.includes('--batch')?bank.filter(q=>q.content_batch===value('--batch')||q.writing_batch===value('--batch')):bank;
if(!items.length)throw new Error('No matching materials');
const chars=s=>[...String(s||'')].length;
// Conservative text-width estimate: Latin, spaces and Japanese have different widths.
const units=s=>[...s].reduce((n,c)=>n+(c===' '? .35:/[\x21-\x7e]/.test(c)?.65:1),0);
function lines(text,capacity){
 let count=1,width=0;
 for(const token of String(text||'').match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*|\n|[^\n]/gu)||[]){
  if(token==='\n'){count++;width=0;continue;}
  let size=units(token);
  if(width&&width+size>capacity){count++;width=0;}
  while(size>capacity){count++;size-=capacity;}
  width+=size;
 }return text?count:0;
}
// A diagram exemption is structural and bounded, not a flag that skips review.
function reviewedKanjiDiagram(item,q,measured){
 if(item.image||item.figure||item.diagram||q.mode!=='kanji_component'||!q.writingDisplay||!q.diagram)return false;
 return (budget.reviewedDiagramProfiles||[]).some(p=>{
  if(item.subject!==p.subject||q.writing_profile!==p.id||!p.parts.includes(q.diagram.parts.length)||Object.entries(p.maxima).some(([k,max])=>measured[k]>max))return false;
  const d=q.writingDisplay,word=q.writing_word??q.word;
  if(chars(d.sentence)>p.maxSentenceChars||chars(word)>p.maxWordChars||chars(d.reading)>p.maxReadingChars||(chars(d.reading)+2)*20+chars(word)*32+14>p.maxReadingWordWidthPx)return false;
  if(!q.choices.every(c=>/^[\u3400-\u9fff\u30a0-\u30ff]$/u.test(c)))return false;
  const parts=q.diagram.parts;
  if(p.id==='compound-parts-v1'){
   return p.layouts.some(layout=>parts.length===layout.boxes.length&&parts.every((part,i)=>chars(part.answer)===1&&part.position===layout.positions[i]&&JSON.stringify(part.box)===JSON.stringify(layout.boxes[i])));
  }
  if(p.id==='tb-parts-v1'){
   const h=parts[0].box[3];if(!p.topHeights.includes(h)||parts.length!==2)return false;
   const expected=[[0,0,100,h],[0,h,100,100-h]];
   return parts.every((part,i)=>chars(part.answer)===1&&part.position===['上','下'][i]&&JSON.stringify(part.box)===JSON.stringify(expected[i]));
  }
  const w=parts[0].box[2];if(!p.leftWidths.includes(w))return false;
  const expected=parts.length===2?[[0,0,w,100],[w,0,100-w,100]]:[[0,0,w,100],[w,0,100-w,50],[w,50,100-w,50]];
  return parts.every((part,i)=>chars(part.answer)===1&&JSON.stringify(part.box)===JSON.stringify(expected[i]));
 });
}
const errors=[],reviewRequired=[],maxima={task:0,prompt:0,choice:0,targetLabel:0,note:0,combined:0};
const ids=new Set(),bankIdCounts=new Map();for(const q of bank)bankIdCounts.set(q.id,(bankIdCounts.get(q.id)||0)+1);let presentations=0;
for(const item of items){
 for(const name of ['id','school_level','grade','subject','field','unit'])if(typeof item[name]!=='string'||!item[name].trim())errors.push({id:item.id,reason:`missing-${name}`});
 if(!item.id||ids.has(item.id)||bankIdCounts.get(item.id)>1)errors.push({id:item.id,reason:'missing-or-duplicate-id'});ids.add(item.id);
 let qs;
 try{qs=item.kind==='choice'?choicePresentations(item).map((_,i,ps)=>makeChoiceQuestion(item,()=>(i+.5)/ps.length)):makeQuestionQueue([item],()=>.5);}
 catch(e){errors.push({id:item.id,reason:e.message});continue;}
 if(!qs.length)errors.push({id:item.id,reason:'no-generated-questions'});
 for(const q of qs){
  presentations++;if(!Array.isArray(q.choices)||q.choices.some(s=>typeof s!=='string')){errors.push({id:q.id,reason:'invalid-choice-strings'});continue;}if(typeof q.prompt!=='string'||!q.prompt.length)errors.push({id:q.id,reason:'missing-prompt'});const issues=[],columns=choiceColumns(q),profile=columns===2?'text-two-columns':'text-four-choices';
  if(q.choices?.length!==4||new Set(q.choices).size!==4||q.choices[q.correct]!==q.answer)errors.push({id:q.id,reason:'invalid-four-choices-or-answer'});
  const fields={task:q.task,prompt:q.prompt,targetLabel:q.targetLabel,note:q.note};
  for(const [name,text] of Object.entries(fields)){const n=chars(text);maxima[name]=Math.max(maxima[name],n);if(n>budget.fields[name])issues.push(`${name}:${n}>${budget.fields[name]}`);}
  for(const c of q.choices){const n=chars(c);maxima.choice=Math.max(maxima.choice,n);if(n>budget.fields.choice)issues.push(`choice:${n}>${budget.fields.choice}`);}
  const combined=chars((q.task||'')+q.prompt+q.choices.join(''));maxima.combined=Math.max(maxima.combined,combined);
  if(combined>budget.combinedTextLimit)issues.push(`combined:${combined}>${budget.combinedTextLimit}`);
  const choiceCapacity=((budget.panelTextWidthPx-(columns-1)*5)/columns-12)/16;
  const rowHeights=[];
  for(let i=0;i<4;i+=columns)rowHeights.push(Math.max(columns===4?64:54,...q.choices.slice(i,i+columns).map(s=>lines(s,choiceCapacity)*23.2+16)));
  const height=24+14+15+lines(q.task,budget.panelTextWidthPx/18)*29.7+17+lines(q.prompt,budget.panelTextWidthPx/22)*36.3+26+rowHeights.reduce((a,b)=>a+b,0)+(rowHeights.length-1)*5+(q.blankIndex?lines(q.targetLabel,budget.panelTextWidthPx/13)*21.5+14:0);
  // Reuse a measured text-only envelope; never waive limits for diagrams/images.
  const measured={...Object.fromEntries(Object.entries(fields).map(([name,text])=>[name,chars(text)])),task:chars(q.task),choice:Math.max(...q.choices.map(chars)),combined};
  const reviewed=!(q.diagram||item.image||item.figure||item.diagram)&&(budget.reviewedTextProfiles||[]).find(p=>p.subject===item.subject&&p.profiles.includes(profile)&&Object.entries(p.maxima).every(([key,max])=>measured[key]<=max));
  const heightLimit=reviewed?.estimatedPanelHeightLimit??budget.estimatedPanelHeightLimit;
  if(height>heightLimit)issues.push(`estimated-height:${Math.ceil(height)}>${heightLimit}`);
  const titleRule=budget.longDefinitionHeading;
  if(titleRule&&item.subject===titleRule.subject&&q.mode===titleRule.mode&&chars(q.prompt)>titleRule.titleCharsOver&&(chars(q.prompt)>titleRule.maxTitleChars||measured.choice>titleRule.maxChoiceChars))issues.push('long-definition-title-needs-layout-review');
  if((q.diagram||item.image||item.figure||item.diagram)&&!reviewedKanjiDiagram(item,q,measured))issues.push('image-or-diagram-profile-review');
  if(issues.length)reviewRequired.push({sourceId:item.id,questionId:q.id,profile,issues});
 }
}
process.stdout.write(JSON.stringify({materials:items.length,presentations,maxima,errors,reviewRequired},null,2)+'\n');
if(errors.length)process.exitCode=1;
