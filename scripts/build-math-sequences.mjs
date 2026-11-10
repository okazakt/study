// Authoring only: stable learning points with a stored example, not app/session tests.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mathSequenceParameters,renderMathSequence} from '../math-sequences.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source='docs/content/math-source/';
const batches=[['math-sequences-20261110','sequences.tsv','individual-choices.tsv'],['math-advanced-20261110','advanced-sequences.tsv','advanced-choices.tsv'],['math-completion-20261110','completion-sequences.tsv','completion-choices.tsv']];
const managed=new Set(batches.map(b=>b[0]));
const base=JSON.parse(read('quiz-data/junior_math.json')).filter(q=>!managed.has(q.content_batch));
const additions=[];
for(const [batch,sequenceFile,choiceFile] of batches){
const sequences=read(source+sequenceFile).trim().split('\n').map(row=>{
 const [grade,field,unit,generator,title]=row.split('|');
 const item={id:'jr_math_sequence_'+generator,subject:'数学',school_level:'中学',grade,field,unit,kind:'math_sequence',title,sequence_generator:generator,content_batch:batch};
 const example=renderMathSequence(item,mathSequenceParameters(generator)[0]);
 return {...item,steps:example.steps};
});
const choices=read(source+choiceFile).trim().split('\n').filter(Boolean).map(row=>{
 const [grade,field,unit,prompt,answer,a,b,c,note]=row.split('|');
 if(!note||new Set([answer,a,b,c]).size!==4)throw Error(row);
 return {id:'jr_math_judgment_'+createHash('sha256').update(prompt).digest('hex').slice(0,12),subject:'数学',school_level:'中学',grade,field,unit,kind:'choice',task:'適切なものを選ぼう',prompt,answer,dummies:[a,b,c],note,content_batch:batch};
});
additions.push(...sequences,...choices);
console.log({batch,sequences:sequences.length,stages:sequences.reduce((a,q)=>a+q.steps.length,0),individual:choices.length});
}
const bank=[...base,...additions];
if(new Set(bank.map(q=>q.id)).size!==bank.length)throw Error('Duplicate math IDs');
writeFileSync(new URL('../quiz-data/junior_math.json',import.meta.url),JSON.stringify(bank,null,2)+'\n');
