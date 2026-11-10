// Authoring only: stable learning points with a stored example, not app/session tests.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mathSequenceParameters,renderMathSequence} from '../math-sequences.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source='docs/content/math-source/',batch='math-sequences-20261110';
const base=JSON.parse(read('quiz-data/junior_math.json')).filter(q=>q.content_batch!==batch);
const sequences=read(source+'sequences.tsv').trim().split('\n').map(row=>{
 const [grade,field,unit,generator,title]=row.split('|');
 const item={id:'jr_math_sequence_'+generator,subject:'数学',school_level:'中学',grade,field,unit,kind:'math_sequence',title,sequence_generator:generator,content_batch:batch};
 const example=renderMathSequence(item,mathSequenceParameters(generator)[0]);
 return {...item,steps:example.steps};
});
const choices=read(source+'individual-choices.tsv').trim().split('\n').map(row=>{
 const [grade,field,unit,prompt,answer,a,b,c,note]=row.split('|');
 if(!note||new Set([answer,a,b,c]).size!==4)throw Error(row);
 return {id:'jr_math_judgment_'+createHash('sha256').update(prompt).digest('hex').slice(0,12),subject:'数学',school_level:'中学',grade,field,unit,kind:'choice',task:'適切なものを選ぼう',prompt,answer,dummies:[a,b,c],note,content_batch:batch};
});
const bank=[...base,...sequences,...choices];
if(new Set(bank.map(q=>q.id)).size!==bank.length)throw Error('Duplicate math IDs');
writeFileSync(new URL('../quiz-data/junior_math.json',import.meta.url),JSON.stringify(bank,null,2)+'\n');
console.log({sequences:sequences.length,stages:sequences.reduce((a,q)=>a+q.steps.length,0),individual:choices.length});
