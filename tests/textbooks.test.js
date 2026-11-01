// Book filtering and curriculum/content checks; no five-minute simulation.
import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {availableTextbookSeries,normalizeTextbookSettings,textbookBooks,textbookUnits,selectTextbookQuestions} from '../textbooks.js';
import {makeQuestionQueue,makeChoiceQuestion} from '../game.js';import {choicePresentations} from '../choice-variants.js';
import {questionKey,normalizeHistory,recordAnswer,questionCoverage} from '../progress.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const data=read('textbook-data/english-2026.json'),report=read('docs/content/english-textbook-audit.json'),curriculum=read('docs/content/english-curriculum-audit.json');
const items=readdirSync(new URL('../quiz-data',import.meta.url)).filter(n=>/^junior_.*\.json$/.test(n)).flatMap(n=>read('quiz-data/'+n));
const by=new Map(items.map(q=>[q.id,q]));
const settings=()=>normalizeTextbookSettings({version:1,usageYear:2026,series:'one-world',unitsByCourse:{}},data);
test('2026 metadata distinguishes usage year, 2025 edition and six series across 18 catalog volumes',()=>{
 assert.equal(data.usageYear,2026);assert.equal(data.editionYear,2025);assert.equal(data.books.length,18);assert.equal(availableTextbookSeries(data).length,6);
 for(const b of data.books){assert.equal(b.bookNumber.slice(-2),`${b.year+6}2`);assert.equal(b.usageYear,2026);assert.equal(b.editionYear,2025);}
 assert.deepEqual(availableTextbookSeries(data).filter(s=>s.available).map(s=>s.id),['one-world']);
 for(const s of data.sources){assert.ok(/^https:\/\//.test(s.url));assert.ok(/^[a-f0-9]{64}$/.test(s.sha256));}
});
test('every selectable mapping resolves to a real lexical material and a documented nonoverlapping page range',()=>{
 for(const b of data.books){const ids=new Set();let end=0;
  for(const u of b.units){assert.ok(!ids.has(u.id));ids.add(u.id);assert.ok(u.pageStart>end);end=u.pageEnd;
   for(const row of u.items){const item=by.get(row.sourceId);assert.equal(item.subject,'英語');assert.ok(item.english);assert.ok(row.page>=u.pageStart&&row.page<=u.pageEnd);assert.ok(['exact_normalized_sense','reviewed_equivalent_sense'].includes(row.evidence.method));assert.ok(row.evidence.row>=8);assert.equal(row.evidence.source,'ow.xlsx');}
  }
 }
 const ow=report.oneWorld;assert.equal(ow.totalEntries,2778);assert.equal(ow.senseConfirmed,1058);assert.equal(ow.exactSenseConfirmed,724);assert.equal(ow.reviewedSenseConfirmed,334);assert.equal(ow.reviewedHeld,14);assert.equal(ow.senseConfirmed+ow.senseReview+ow.headwordUnmatched,ow.totalEntries);
 assert.equal(report.newHorizon.totalEntries,2402);assert.equal(report.newHorizon.headwordMatched,1344);
});
test('same spelling with another meaning is excluded: care as noun and kind meaning type do not match existing senses',()=>{
 const care=report.oneWorld.entries.find(e=>e.headword==='care');assert.equal(care.status,'sense_review');
 const kindNoun=report.oneWorld.entries.find(e=>e.headword==='kind'&&e.row===1295);assert.equal(kindNoun.status,'sense_review');
 for(const b of data.books)for(const u of b.units)assert.ok(!u.items.some(r=>r.evidence.row===1295));
});
test('unit combinations, explicit empty choices and independent grade settings never silently broaden to common content',()=>{
 const s=settings(),course='中学:英語:1',units=textbookUnits(data,s,course).filter(u=>u.items.length);const chosen=units.slice(0,2),allowed=new Set(chosen.flatMap(u=>u.items.map(r=>r.sourceId)));
 s.unitsByCourse[course]=chosen.map(u=>u.id);const selected=selectTextbookQuestions(items,data,s,{id:course,practiceType:'all'});
 assert.ok(selected.length);assert.ok(selected.every(q=>allowed.has(q.id)));assert.deepEqual(new Set(selected.map(q=>q.id)),allowed);
 s.unitsByCourse[course]=[];assert.equal(selectTextbookQuestions(items,data,s,{id:course}).length,0);
 assert.ok(selectTextbookQuestions(items,data,s,{id:'中学:英語:2'}).length);assert.equal(textbookBooks(data,s,'高校:英語:1').length,0);
 assert.equal(selectTextbookQuestions(items,data,s,{id:'中学:英語:1',practiceType:'grammar'}).length,0);
});
test('book grade overrides provisional common grade while identity, directional history and book provenance survive reload',()=>{
 const s=settings(),course='中学:英語:1',selection={id:course,practiceType:'word_en_ja'};
 const selected=selectTextbookQuestions(items,data,s,selection);const item=selected.find(q=>by.get(q.id).grade!=='中1');assert.ok(item);assert.equal(item.grade,'中1');
 const q=makeQuestionQueue([item],()=>.5,q=>q.mode==='to_japanese')[0],common=makeQuestionQueue([by.get(item.id)],()=>.5,q=>q.mode==='to_japanese')[0];assert.equal(questionKey(q),questionKey(common));
 let history=recordAnswer(normalizeHistory(null),q,{correct:true,chosen:q.answer,attempt:'one',course,time:1});history=normalizeHistory(JSON.parse(JSON.stringify(history)));
 assert.equal(history.events[0].grade,'中1');assert.equal(history.events[0].textbook.usageYear,2026);assert.equal(history.events[0].textbook.editionYear,2025);assert.equal(history.events[0].textbook.bookNumber,'017-72');assert.equal(questionCoverage([q,common],history).total,1);assert.equal(questionCoverage([q],history).solved,1);
});
test('exam scope deduplicates shared words across volumes and saved invalid unit IDs remain empty rather than all',()=>{
 const s=settings(),q=selectTextbookQuestions(items,data,s,{id:'中学:英語:exam'});assert.equal(new Set(q.map(q=>q.id)).size,q.length);
 assert.ok(q.every(q=>['中1','中2','中3'].includes(q.grade)));
 const restored=normalizeTextbookSettings({...s,unitsByCourse:{'中学:英語:1':['unknown-unit']}},data);assert.deepEqual(restored.unitsByCourse['中学:英語:1'],[]);assert.equal(selectTextbookQuestions(items,data,restored,{id:'中学:英語:1'}).length,0);
 assert.equal(normalizeTextbookSettings({...s,usageYear:2025},data).series,'');assert.equal(normalizeTextbookSettings({...s,series:'new-horizon'},data).series,'');
});
test('national curriculum audit covers all 60 documented criteria without calling speech/audio or entire curriculum complete',()=>{
 assert.equal(curriculum.completeCurriculum,false);assert.equal(curriculum.criteria.length,60);assert.equal(new Set(curriculum.criteria.map(c=>c.id)).size,60);
 for(const c of curriculum.criteria){assert.ok(c.reference&&c.remaining);for(const id of c.evidenceIds)assert.ok(by.has(id),id);if(c.status==='has_examples')assert.ok(c.evidenceIds.length);}
 assert.equal(curriculum.criteria.filter(c=>c.id.startsWith('domain-')).length,5);assert.ok(curriculum.criteria.filter(c=>c.id.startsWith('sound-')).every(c=>c.status==='not_implemented'));
});
test('18 curriculum gap points provide 36 original, uniquely answerable presentations within the display budget',()=>{
 const added=items.filter(q=>q.content_batch==='english-curriculum-1');assert.equal(added.length,18);
 for(const item of added)for(const p of choicePresentations(item)){assert.equal(new Set([p.answer,...p.dummies]).size,4);assert.ok([p.answer,...p.dummies].every(s=>[...s].length<=30));assert.ok([...p.prompt+item.task+p.answer+p.dummies.join('')].length<=200,item.id);const q=makeChoiceQuestion(item,()=>.5);assert.equal(q.choices[q.correct],q.answer);}
});

test('manual sense approvals are pinned to source and current material hashes; holds never become selectable',()=>{
 const ledger=read('textbook-data/one-world-reviewed.json'),sha=s=>createHash('sha256').update(s).digest('hex');
 assert.equal(ledger.sourceSha256,data.sources.find(s=>s.id==='ow.xlsx').sha256);
 assert.equal(data.reviewLedger.sha256,sha(readFileSync(new URL('../textbook-data/one-world-reviewed.json',import.meta.url))));
 assert.equal(new Set(ledger.decisions.map(d=>d.row)).size,ledger.decisions.length);
 const mappings=data.books.flatMap(b=>b.units.flatMap(u=>u.items));
 for(const d of ledger.decisions){const item=by.get(d.sourceId),row=report.oneWorld.entries.find(r=>r.row===d.row);
  assert.equal(d.materialSenseSha256,sha(item.english+'\0'+item.japanese));assert.equal(row.headword,d.headword);
  assert.equal(row.status,d.decision==='approved'?'sense_confirmed':'sense_review');
  const linked=mappings.filter(m=>m.evidence.row===d.row);
  if(d.decision==='hold')assert.equal(linked.length,0);
  else for(const m of linked){assert.equal(m.evidence.method,'reviewed_equivalent_sense');assert.equal(m.evidence.meaningSha256,d.publisherMeaningSha256);}
 }
 for(const row of [1612,1338,1463,1404,2658])assert.equal(report.oneWorld.entries.find(r=>r.row===row).status,'sense_review');
 const during=items.find(q=>q.english==='during');assert.equal(during.japanese,'〜の期間中に');assert.ok(during.note.includes('throughout'));
 for(const q of items)if(q.english_dummies?.includes('during'))assert.equal(q.japanese_dummies[q.english_dummies.indexOf('during')],during.japanese);
});
