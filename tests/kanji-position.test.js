import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {kanjiWritingDisplay,makeJapaneseQuestions,revealPlan} from '../game.js';
import {focusReveal} from '../focus-game.js';
const read=n=>JSON.parse(readFileSync(new URL('../quiz-data/'+n+'.json',import.meta.url)));
const items=[...read('junior_japanese'),...read('junior_expansion')].filter(q=>q.kind==='kanji');
test('every existing kanji masks its explicit character position without ordinal instructions or answer leakage',()=>{
 for(const item of items){
  const chars=Array.from(item.word),display=kanjiWritingDisplay(item);assert.equal(chars[item.writing_target_index],item.character);
  assert.equal(Array.from(display.maskedWord)[item.writing_target_index],'□');assert.equal(Array.from(display.maskedWord).length,chars.length);
  const [reading,...parts]=makeJapaneseQuestions(item,()=>.5);assert.equal(reading.id,`${item.id}:kanji_reading`);assert.ok(!reading.writingDisplay);
  for(const [i,q] of parts.entries()){
   assert.equal(q.id,`${item.id}:kanji_component:${i+1}`);assert.deepEqual(q.writingDisplay,display);assert.equal(q.answer,item.writing_parts[i].answer);
   assert.ok(!q.prompt.includes(item.character));assert.ok(!/最初の漢字|二つ目の漢字/.test(q.prompt+q.targetLabel+q.reviewLabel));
   assert.equal(q.continuation,i>0);assert.ok(q.prompt.includes(item.reading));assert.ok(q.prompt.includes(display.maskedWord));
  }
 }
});
test('the approved examples include first, second, and okurigana target positions',()=>{
 for(const [word,mask] of [['河川','□川'],['擁護','□護'],['快適','□適'],['基礎','基□'],['諭す','□す']])assert.equal(kanjiWritingDisplay(items.find(q=>q.word===word)).maskedWord,mask);
});
test('repeated characters require an explicit index and mask only the selected occurrence',()=>{
 const item={id:'repeat',word:'人人',character:'人',reading:'ひとびと',writing_hint:'人々。'};
 assert.throws(()=>kanjiWritingDisplay(item),/writing_target_index/);assert.equal(kanjiWritingDisplay({...item,writing_target_index:1}).maskedWord,'人□');
 assert.throws(()=>kanjiWritingDisplay({...item,writing_target_index:2}),/writing_target_index/);
});
test('continuation keeps the new word-position display without replaying it at any speed',()=>{
 const item=items.find(q=>q.word==='擁護'),parts=makeJapaneseQuestions(item,()=>.5).slice(1);
 for(const speed of ['slow','normal','fast','instant'])for(const plan of [revealPlan(parts[1],speed),focusReveal(parts[1],speed)]){
  assert.equal(plan.continuation,true);assert.deepEqual(plan.prompt,{start:0,end:0});assert.ok(plan.choices[1].start>=plan.choices[0].start);
 }
 assert.ok(revealPlan(parts[0],'slow').prompt.end>0);assert.ok(focusReveal(parts[0],'slow').prompt.end>0);
});
