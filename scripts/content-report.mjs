// Generate an inventory, not a curriculum-completion percentage.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeQuestionQueue} from '../game.js';
import {buildCatalog} from '../learning.js';
import {mathVariantParameters} from '../math-variants.js';
const files=['junior_japanese','junior_english','junior_math','junior_science','junior_social','junior_expansion','junior_english_supplement','junior_english_vocabulary2','junior_english_core','junior_english_application','junior_english_extended'];
const items=files.flatMap(file=>JSON.parse(readFileSync(new URL(`../quiz-data/${file}.json`,import.meta.url))));
const catalog=buildCatalog(items).filter(c=>c.school==='中学'&&c.year!=='exam');
const lines=['# 中学コンテンツ収録一覧','','`node scripts/content-report.mjs` で再生成。素材数と、逆方向・複数回答段階を含む生成問題数を区別する。内部の表現違いは追加しても別素材として数えない。','','現在は英語優先の大規模拡充・第7回まで反映。全単元・全知識の網羅や、特定教科書準拠を意味しない。配当学年は暫定であり、出版社・学校の進度によって異なる。小学校内容の復習も含む。','','| 教科 | 学年 | 素材数 | 生成問題数 | 収録単元 |','| --- | --- | ---: | ---: | --- |'];
for(const c of catalog){const selected=items.filter(q=>c.ids.includes(q.id));lines.push(`| ${c.subject} | ${c.year} | ${selected.length} | ${makeQuestionQueue(selected,()=>.5).length} | ${c.sections.map(s=>s.label).join('、')} |`);}
lines.push('',`合計：${items.length}素材、${makeQuestionQueue(items,()=>.5).length}生成問題。`,'','今後の充足・未充足の管理は [拡充計画](junior-plan.md) を参照。教科書対応は未収録。','');
const numeric=items.filter(item=>item.numeric_generator);
lines.push(`数学の数値変更対応：${numeric.length}学習ポイント、${numeric.reduce((sum,item)=>sum+mathVariantParameters(item.numeric_generator).length,0)}通り。数値パターンは素材数・生成問題数に加算しない。`,'');
writeFileSync(new URL('../docs/content/junior-inventory.md',import.meta.url),lines.join('\n'));
console.log(`Inventory: ${items.length} materials, ${makeQuestionQueue(items,()=>.5).length} generated questions`);
