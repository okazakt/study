// Authoring inventory, not an app test or session simulation.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const items=['junior_science','junior_expansion'].flatMap(n=>read('quiz-data/'+n+'.json')).filter(q=>q.school_level==='中学'&&q.subject==='理科');
const blocks=read('docs/content/science-source/curriculum-blocks.json');
const sourceIds=new Set(items.map(q=>q.id));if(sourceIds.size!==items.length)throw Error('duplicate science ID');
const legacy={
 '生物の成長と生殖':'s5','遺伝の規則性と遺伝子':'s5','生物の種類の多様性と進化':'s5','自然界のつながり':'s7','自然環境の調査と保全':'s7',
 '光':'p1','音':'p1','力':'p1','力のつり合い':'p5','運動':'p5','仕事とエネルギー':'p5','電流':'p3','電流と磁界':'p3',
 '物質の性質':'p2','気体':'p2','水溶液':'p2','状態変化':'p2','実験操作':'p2','化学変化':'p4','化学反応式':'p4','酸化と還元':'p4','イオン':'p6','酸とアルカリ':'p6','電池':'p6',
 '観察器具':'s1','植物の分類':'s1','動物の分類':'s1','植物のつくり':'s3','細胞':'s3','消化と吸収':'s3','血液の循環':'s3','呼吸':'s3','排出':'s3','神経':'s3',
 '火山':'s2','地震':'s2','地層':'s2','天気':'s4','日本の気象':'s4','天体':'s6','資源とエネルギー':'p7','科学技術と生活':'p7'};
const official=q=>q.official_blocks||[q.prompt?.includes('圧力は')?'s4':q.grade==='中3'&&q.unit==='力'?'p5':legacy[q.unit]].filter(Boolean);
const report={version:read('package.json').version,date:'2026-11-10',materials:items.length,generated:makeQuestionQueue(items,()=>.5).length,scope:'公式小項目と取扱いの照合を終え、暗記・短い実験判断の基礎版整備を一区切り。出題先の存在を全知識の網羅率や実技能の習得と扱わない。',fields:Object.fromEntries(['物理','化学','生物','地学','環境'].map(field=>{const qs=items.filter(q=>q.field===field);return [field,{materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length,units:[...new Set(qs.map(q=>q.unit))]}]})),grades:Object.fromEntries(['中1','中2','中3'].map(grade=>{const qs=items.filter(q=>q.grade===grade);return [grade,{materials:qs.length,generated:makeQuestionQueue(qs,()=>.5).length}]})),blocks:blocks.rows.map(b=>({...b,sourceIds:items.filter(q=>official(q).includes(b.id)).map(q=>q.id)})),unmappedSourceIds:items.filter(q=>!official(q).length).map(q=>q.id)};
if(report.unmappedSourceIds.length)throw Error('Unmapped sources: '+report.unmappedSourceIds.join(','));
writeFileSync(new URL('../docs/content/science-progress.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({materials:report.materials,generated:report.generated,fields:report.fields,grades:report.grades},null,2));
