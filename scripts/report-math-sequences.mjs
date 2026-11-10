// Editorial inventory. Numeric variants do not inflate learning coverage.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
import {mathSequenceParameters,renderMathSequence} from '../math-sequences.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const items=['junior_math','junior_expansion'].flatMap(f=>read('quiz-data/'+f+'.json')).filter(q=>q.subject==='数学');
const sequences=items.filter(q=>q.kind==='math_sequence');
const count=qs=>({materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length});
const report={version:read('package.json').version,date:'2026-11-10',...count(items),scope:'短い連続解法の補強段階。公式の23区分で残作業を整理済み。公式小項目の最終照合と全体の完了判断は次段階。',
 grades:Object.fromEntries(['中1','中2','中3'].map(g=>[g,count(items.filter(q=>q.grade===g))])),
 sequences:sequences.map(q=>({id:q.id,grade:q.grade,field:q.field,unit:q.unit,title:q.title,stages:q.steps.length,skills:q.steps.map(s=>s.skill),numericalVariants:mathSequenceParameters(q.sequence_generator).length})),
 sequenceMaterials:sequences.length,sequenceStages:sequences.reduce((n,q)=>n+q.steps.length,0),numericalVariants:sequences.reduce((n,q)=>n+mathSequenceParameters(q.sequence_generator).length,0)};
writeFileSync(new URL('../docs/content/math-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--export')){
 const path=process.argv[process.argv.indexOf('--export')+1];
 writeFileSync(path,JSON.stringify(sequences.flatMap(q=>mathSequenceParameters(q.sequence_generator).map(parameters=>({generator:q.sequence_generator,parameters,steps:renderMathSequence(q,parameters).steps})))));
}
console.log(JSON.stringify({materials:report.materials,generated:report.generated,grades:report.grades,sequenceMaterials:report.sequenceMaterials,sequenceStages:report.sequenceStages,numericalVariants:report.numericalVariants}));
