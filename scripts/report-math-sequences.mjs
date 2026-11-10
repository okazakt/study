// Editorial inventory. Numeric variants do not inflate learning coverage.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
import {mathSequenceParameters,renderMathSequence} from '../math-sequences.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const items=['junior_math','junior_expansion'].flatMap(f=>read('quiz-data/'+f+'.json')).filter(q=>q.subject==='数学');
const sequences=items.filter(q=>q.kind==='math_sequence');
const count=qs=>({materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length});
const report={version:read('package.json').version,date:'2026-11-10',...count(items),scope:'公式内容と取扱いの照合を終え、暗記・短い連続解法・判断の基礎版整備を一区切り。全入試や実技能の網羅とは区別する。',
 grades:Object.fromEntries(['中1','中2','中3'].map(g=>[g,count(items.filter(q=>q.grade===g))])),
 sequences:sequences.map(q=>({id:q.id,grade:q.grade,field:q.field,unit:q.unit,title:q.title,stages:q.steps.length,skills:q.steps.map(s=>s.skill),numericalVariants:mathSequenceParameters(q.sequence_generator).length})),
 sequenceMaterials:sequences.length,sequenceStages:sequences.reduce((n,q)=>n+q.steps.length,0),numericalVariants:sequences.reduce((n,q)=>n+mathSequenceParameters(q.sequence_generator).length,0)};
writeFileSync(new URL('../docs/content/math-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--export')){
 const path=process.argv[process.argv.indexOf('--export')+1];
 writeFileSync(path,JSON.stringify(sequences.flatMap(q=>mathSequenceParameters(q.sequence_generator).map(parameters=>({generator:q.sequence_generator,parameters,steps:renderMathSequence(q,parameters).steps})))));
}
console.log(JSON.stringify({materials:report.materials,generated:report.generated,grades:report.grades,sequenceMaterials:report.sequenceMaterials,sequenceStages:report.sequenceStages,numericalVariants:report.numericalVariants}));
