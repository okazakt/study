// Authoring inventory and official-block mapping; no app tests or playback.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const items=['junior_social','junior_expansion'].flatMap(n=>read('quiz-data/'+n+'.json')).filter(q=>q.school_level==='中学'&&q.subject==='社会');
const blocks=read('docs/content/social-source/curriculum-blocks.json');
const sourceIds=new Set(items.map(q=>q.id));if(sourceIds.size!==items.length)throw Error('duplicate social source ID');
const report={version:read('package.json').version,date:'2026-11-09',materials:items.length,generated:makeQuestionQueue(items,()=>.5).length,
 scope:'公式の内容のまとまりを参照した編集用の進捗。ブロックの素材数や問題の存在は網羅率・習熟率を表さない。',
 fields:Object.fromEntries(['地理','歴史','公民'].map(field=>{const qs=items.filter(q=>q.field===field);return [field,{materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length,units:[...new Set(qs.map(q=>q.unit))]}];})),
 blocks:blocks.rows.map(b=>({...b,sourceIds:items.filter(q=>q.official_blocks?.includes(b.id)).map(q=>q.id),status:'補強中'}))};
writeFileSync(new URL('../docs/content/social-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({materials:report.materials,generated:report.generated,fields:report.fields},null,2));
