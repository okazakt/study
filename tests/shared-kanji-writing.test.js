import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeJapaneseQuestions,makeQuestionQueue} from '../game.js';
import {matchesPracticeItem,matchesPracticeQuestion} from '../learning.js';
import {normalizeHistory,recordAnswer,buildPriorityIndex,priorityCategory} from '../progress.js';
const all=['junior_japanese','junior_expansion','junior_japanese_kanji'].flatMap(name=>JSON.parse(readFileSync(new URL(`../quiz-data/${name}.json`,import.meta.url))));
const shared=all.filter(i=>i.reading_enabled===false);
test('shared-word characters get writing only, keep original reading source and filters',()=>{
 assert.equal(shared.length,4);
 for(const item of shared){
  const parent=all.find(p=>p.id===item.reading_source_id);assert(parent.word.includes(item.character));
  const q=makeJapaneseQuestions(item,()=>.5);assert.equal(q.length,1);assert.equal(q[0].mode,'kanji_component');assert.equal(q[0].sourceId,parent.id);assert.equal(q[0].id,`${item.id}:kanji_whole`);assert.equal(q[0].writingDisplay.maskedWord,item.writing_word.replace(item.character,'□'));assert.equal(q[0].character,item.character);
  assert(matchesPracticeItem(item,'kanji_write'));assert(!matchesPracticeItem(item,'kanji_read'));assert(matchesPracticeQuestion(q[0],'kanji_write'));
  assert(makeQuestionQueue([item]).every(q=>q.mode!=='kanji_reading'));
  const reading=makeJapaneseQuestions(parent,()=>.5).find(q=>q.mode==='kanji_reading');assert.equal(reading.id,`${parent.id}:kanji_reading`);
  for(const correct of [true,false]){
   const history=recordAnswer(normalizeHistory(null),reading,{correct});
   assert.equal(priorityCategory(q[0],buildPriorityIndex(history)),correct?3:2);
   const after=recordAnswer(history,q[0],{correct:true,chosen:q[0].answer});assert.equal(Object.keys(after.questions).length,2);
  }
 }
});
