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
 assert.deepEqual(availableTextbookSeries(data).filter(s=>s.available).map(s=>s.id),['one-world','here-we-go']);
 for(const s of data.sources){assert.ok(/^https:\/\//.test(s.url));assert.ok(/^[a-f0-9]{64}$/.test(s.sha256));}
});
test('every selectable mapping resolves to reviewed lexical or grammar evidence without inventing pages',()=>{
 for(const b of data.books){const ids=new Set();let end=0;
  for(const u of b.units){assert.ok(!ids.has(u.id));ids.add(u.id);if(b.series==='one-world'){assert.ok(u.pageStart>end);end=u.pageEnd;}else{assert.equal(u.pageStart,null);assert.equal(u.pageEnd,null);}
   for(const row of u.items){const item=by.get(row.sourceId);assert.equal(item.subject,'英語');if(b.series==='one-world'){assert.ok(item.english);assert.ok(row.page>=u.pageStart&&row.page<=u.pageEnd);assert.ok(['exact_normalized_sense','reviewed_equivalent_sense'].includes(row.evidence.method));assert.equal(row.evidence.source,'ow.xlsx');}else{assert.equal(item.field,'英文法');assert.equal(row.page,null);assert.equal(row.evidence.method,'reviewed_grammar_topic');assert.equal(row.evidence.source,'hwg.xlsx');}assert.ok(row.evidence.row>=8);}
  }
 }
 const ow=report.oneWorld;assert.equal(ow.totalEntries,2778);assert.equal(ow.senseConfirmed,1067);assert.equal(ow.exactSenseConfirmed,730);assert.equal(ow.reviewedSenseConfirmed,337);assert.equal(ow.reviewedHeld,15);assert.equal(ow.senseConfirmed+ow.senseReview+ow.headwordUnmatched,ow.totalEntries);
 assert.equal(report.newHorizon.totalEntries,2402);assert.equal(report.newHorizon.headwordMatched,1344);
});
test('same spelling with another meaning is excluded: care as noun and kind meaning type do not match existing senses',()=>{
 const care=report.oneWorld.entries.find(e=>e.headword==='care');assert.equal(care.status,'sense_review');
 const kindNoun=report.oneWorld.entries.find(e=>e.headword==='kind'&&e.row===1295);assert.equal(kindNoun.status,'sense_review');
 for(const b of data.books)for(const u of b.units)assert.ok(!u.items.some(r=>r.evidence.source==='ow.xlsx'&&r.evidence.row===1295));
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
  const linked=mappings.filter(m=>m.evidence.source==='ow.xlsx'&&m.evidence.row===d.row);
  if(d.decision==='hold')assert.equal(linked.length,0);
  else for(const m of linked){assert.equal(m.evidence.method,'reviewed_equivalent_sense');assert.equal(m.evidence.meaningSha256,d.publisherMeaningSha256);}
 }
 for(const row of [1612,1338,1463,1404,2658])assert.equal(report.oneWorld.entries.find(r=>r.row===row).status,'sense_review');
 const during=items.find(q=>q.english==='during');assert.equal(during.japanese,'〜の期間中に');assert.ok(during.note.includes('throughout'));
 for(const q of items)if(q.english_dummies?.includes('during'))assert.equal(q.japanese_dummies[q.english_dummies.indexOf('during')],during.japanese);
});

test('Here We Go grammar units select only reviewed grammar, preserve grade provenance and never invent pages',()=>{
 const s=normalizeTextbookSettings({version:1,usageYear:2026,series:'here-we-go',unitsByCourse:{}},data),books=textbookBooks(data,s,'中学:英語:exam');
 assert.equal(books.length,3);assert.equal(books.flatMap(b=>b.units).length,24);assert.equal(books.flatMap(b=>b.units).filter(u=>u.items.length).length,23);
 assert.equal(report.hereWeGo.mappedMaterials,95);assert.equal(report.hereWeGo.mappings,99);
 const exam=selectTextbookQuestions(items,data,s,{id:'中学:英語:exam'});assert.equal(exam.length,95);assert.equal(new Set(exam.map(q=>q.id)).size,95);assert.ok(exam.every(q=>q.field==='英文法'&&q.textbook.page===null));
 assert.equal(selectTextbookQuestions(items,data,s,{id:'中学:英語:1',practiceType:'word_en_ja'}).length,0);
 assert.equal(selectTextbookQuestions(items,data,s,{id:'中学:英語:1',practiceType:'reading'}).length,0);
 s.unitsByCourse['中学:英語:1']=['hwg1-unit-2'];const selected=selectTextbookQuestions(items,data,s,{id:'中学:英語:1',practiceType:'grammar'});assert.equal(selected.length,3);assert.ok(selected.every(q=>q.textbook.unitId==='hwg1-unit-2'));
 s.unitsByCourse['中学:英語:1']=[];assert.equal(selectTextbookQuestions(items,data,s,{id:'中学:英語:1'}).length,0);
 const reused=selectTextbookQuestions(items,data,s,{id:'中学:英語:2'}).find(q=>q.id==='jr_english_core_past');assert.equal(reused.grade,'中2');assert.equal(by.get(reused.id).grade,'中1');
 const q=makeQuestionQueue([reused],()=>.5)[0],common=makeQuestionQueue([by.get(reused.id)],()=>.5)[0];assert.equal(questionKey(q),questionKey(common));
 const h=normalizeHistory(JSON.parse(JSON.stringify(recordAnswer(normalizeHistory(null),q,{correct:true,chosen:q.answer,time:10,attempt:'hwg'}))));assert.equal(h.events[0].textbook.bookId,'here-we-go-2-2026');assert.equal(h.events[0].textbook.page,null);
});
test('grammar review pins all 99 correspondence decisions to the same source and material content',()=>{
 const ledger=read('textbook-data/here-we-go-grammar-reviewed.json'),sha=s=>createHash('sha256').update(s).digest('hex');
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 assert.equal(ledger.sourceSha256,data.sources.find(s=>s.id==='hwg.xlsx').sha256);assert.equal(data.grammarReviewLedger.sha256,sha(readFileSync(new URL('../textbook-data/here-we-go-grammar-reviewed.json',import.meta.url))));
 for(const u of ledger.units){const unit=data.books.find(b=>b.series==='here-we-go'&&b.year===u.year).units.find(v=>v.id===`hwg${u.year}-unit-${u.unitNumber}`);assert.equal(unit.items.length,u.items.length);
  for(const entry of u.items){assert.equal(entry.materialSha256,sha(JSON.stringify(stable(by.get(entry.sourceId)))));const linked=unit.items.find(r=>r.sourceId===entry.sourceId);assert.equal(linked.evidence.languageMaterialSha256,u.languageMaterialSha256);assert.equal(linked.evidence.row,u.row);}
 }
});
test('twelve missing grammar points provide 24 authored contexts with shared histories and unique choices',()=>{
 const added=items.filter(q=>q.content_batch==='english-textbook-grammar-1');assert.equal(added.length,12);
 for(const item of added){const variants=choicePresentations(item);assert.equal(variants.length,2);assert.notEqual(variants[0].prompt,variants[1].prompt);
  for(const p of variants){assert.equal(new Set([p.answer,...p.dummies]).size,4);assert.ok([p.answer,...p.dummies].every(s=>[...s].length<=30));assert.ok([...p.prompt+item.task+p.answer+p.dummies.join('')].length<=200);}
  assert.equal(questionKey(makeChoiceQuestion(item,()=>0)),questionKey(makeChoiceQuestion(item,()=>.99)));
 }
});
