// Authoring-only mapping/integrity check. No session simulation or browser loop.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const review=read('docs/content/new-horizon-main-review.json'),map=read('docs/content/nh-content/row-material-map.json');
const items=readdirSync(new URL('../quiz-data',import.meta.url)).filter(f=>/^junior_.*\.json$/.test(f)).flatMap(f=>read('quiz-data/'+f));
const byId=new Map(items.map(q=>[q.id,q]));if(byId.size!==items.length)throw Error('Duplicate material ID');
const rows=new Map(map.rows.map(r=>[r.row,r]));if(rows.size!==review.totalRows||rows.size!==map.denominator)throw Error('Incomplete denominator');
for(const r of review.rows){const entry=rows.get(r.row);if(!entry||entry.headword!==r.headword||!entry.materialIds.length)throw Error('Missing source row '+r.row);for(const id of entry.materialIds)if(!byId.has(id))throw Error('Missing mapped material '+id);}
const hashes=Object.fromEntries([...new Set(map.rows.flatMap(r=>r.materialIds))].sort().map(id=>[id,createHash('sha256').update(JSON.stringify(byId.get(id))).digest('hex')]));
const version=read('package.json').version,added=items.filter(q=>q.content_batch==='english-new-horizon-1');
const report={version,checked:'2026-11-05',source:map.source,denominator:map.denominator,mappedRows:rows.size,unmappedRows:0,definition:map.definition,additionalMaterials:added.length,additionalVocabulary:added.filter(q=>q.english).length,additionalGrammar:added.filter(q=>q.kind==='choice').length,meaningContexts:added.filter(q=>q.meaning_context).length,uniqueMappedMaterials:Object.keys(hashes).length,materialHashes:hashes};
writeFileSync(new URL('../docs/content/new-horizon-coverage.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,materialHashes:undefined},null,2));
