// Authoring inventory/scope check, not a test suite or playback simulation.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const names=['junior_japanese','junior_expansion','junior_japanese_kanji','junior_japanese_extended'];
const stored=names.flatMap(n=>read('quiz-data/'+n+'.json')).filter(q=>q.subject==='国語');
const items=stored.filter(q=>q.school_level==='中学'),reserved=stored.filter(q=>q.school_level==='小学');
const scope=read('docs/content/japanese-source/joyo-scope.json'),target=new Set(scope.filter(c=>!c.elementary).map(c=>c.character)),elementary=new Set(scope.filter(c=>c.elementary).map(c=>c.character));
const kanji=items.filter(q=>q.kind==='kanji'),readings=new Set(kanji.map(q=>q.character)),writing=new Set(kanji.filter(q=>q.writing_parts?.length).map(q=>q.character));
const mapping=read('docs/content/japanese-source/kanji-reading-map.json'),byId=new Map(kanji.map(q=>[q.id,q]));
for(const m of mapping){const q=byId.get(m.sourceId);if(!q||!q.word.includes(m.character))throw Error('invalid reading map '+m.character);readings.add(m.character);}
const missing=[...target].filter(c=>!readings.has(c));
const report={date:'2026-11-07',materials:items.length,generated:makeQuestionQueue(items,()=>.5).length,secondaryReading:{covered:[...target].filter(c=>readings.has(c)).length,target:target.size,missing,scope:'字種ごとに最低一つの語の読み。全音訓・全語義の完了とはしない。'},writing:{elementaryScope:'小学配当漢字は中学の完成対象外。小学の部向けに保管。',secondaryCovered:[...target].filter(c=>writing.has(c)).length,secondaryTarget:target.size,secondaryMissing:[...target].filter(c=>!writing.has(c)),scope:'部品選択の素材数。実際の手書き・筆順の習熟とは区別する。'},reservedForElementary:{materials:reserved.length,writingCharacters:new Set(reserved.filter(q=>q.writing_parts?.length).map(q=>q.character)).size,displayed:false,historyPreserved:true},fields:Object.fromEntries([...new Set(items.map(q=>q.field))].map(field=>{const qs=items.filter(q=>q.field===field);return [field,{materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length,units:[...new Set(qs.map(q=>q.unit))]}];}))};
writeFileSync(new URL('../docs/content/japanese-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(missing.length)process.exitCode=1;
