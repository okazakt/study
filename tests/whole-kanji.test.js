import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeJapaneseQuestions,seededRandom,Game} from '../game.js';
import {FocusGame} from '../focus-game.js';
import {matchesPracticeItem,matchesPracticeQuestion} from '../learning.js';
const items=JSON.parse(readFileSync(new URL('../quiz-data/junior_japanese_kanji.json',import.meta.url))).filter(i=>i.writing_format==='whole');
test('whole writing retains b/b/c/d pool but selects only three distinct distractors',()=>{
 for(const item of items){
  assert.equal(item.writing_dummies.length,4);assert.deepEqual(Object.values(item.writing_distractor_groups).map(a=>a.length),[2,1,1]);
  const omitted=new Set();
  for(let seed=1;seed<=64;seed++){
   const q=makeJapaneseQuestions(item,seededRandom(seed))[1];
   assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert.equal(q.choices[q.correct],item.character);
   const missing=item.writing_dummies.filter(x=>!q.choices.includes(x));assert.equal(missing.length,1);omitted.add(missing[0]);
   assert(q.choices.filter(x=>x!==item.character).every(x=>item.writing_dummies.includes(x)));
   assert.equal(q.id,`${item.id}:kanji_whole`);assert.equal(q.mode,'kanji_component');assert.equal(q.blankTotal,1);assert.equal(q.diagram,undefined);
   assert.equal(q.writingDisplay.maskedWord.includes(item.character),false);assert(matchesPracticeQuestion(q,'kanji_write'));
  }
  assert.equal(omitted.size,4);assert(matchesPracticeItem(item,'kanji_write'));assert(matchesPracticeItem(item,'kanji_read'));
 }
});
test('whole writing uses four color lanes in normal and focus; wrong answer stays until correct',()=>{
 const item=items.find(i=>i.character==='圏');
 const events=Array.from({length:120},(_,i)=>({time:1+i*.5,bar:Math.floor(i/4),beatInBar:i%4+1,beatPosition:0}));
 const focus=new FocusGame([item],events,0,()=>.5,60,q=>q.mode==='kanji_component',null,60,null,{speed:'instant'});
 focus.update(0);const id=focus.question.id;focus.tap((focus.question.correct+1)%4,1);assert.equal(focus.question.id,id);assert.equal(focus.wrongCount,1);
 focus.tap(focus.question.correct,1.5);assert.equal(focus.correctCount,1);assert.equal(focus.phase,'feedback');assert.equal(focus.combo,0);
 const normal=new Game([item],events,0,()=>.5,60,q=>q.mode==='kanji_component',null,60,null,{speed:'instant'});
 normal.changePhase('answer',0);
 for(let n=0;n<3;n++){const t=1+n*.5;normal.notes.push({target:t,color:normal.question.correct,lane:normal.question.correct,row:'whole-'+n,done:false});normal.tap(normal.question.correct,t);}
 assert.equal(normal.correctCount,1);assert.equal(normal.phase,'feedback');assert.equal(normal.laneCount,4);
});
