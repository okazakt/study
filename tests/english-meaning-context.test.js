import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnglishQuestion} from '../game.js';
import {normalizeHistory,recordAnswer,questionKey} from '../progress.js';
const book={id:'book-noun',english:'book',japanese:'本',meaning_context:'I read a book.',english_dummies:['magazine','letter','newspaper'],japanese_dummies:['雑誌','手紙','新聞']};
test('translation context distinguishes a sense while the answer remains the headword',()=>{
 const ja=makeEnglishQuestion(book,'to_japanese',()=>.5),en=makeEnglishQuestion(book,'to_english',()=>.5);
 assert.equal(ja.prompt,'book\nI read a book.');assert.equal(ja.answer,'本');assert.equal(en.prompt,'本');assert.equal(en.answer,'book');
 const legacy=makeEnglishQuestion({...book,meaning_context:undefined},'to_japanese',()=>.5);assert.equal(legacy.prompt,'book');
});
test('different meanings of the same spelling keep independent learning histories',()=>{
 const noun=makeEnglishQuestion(book,'to_japanese',()=>.5);
 const verb=makeEnglishQuestion({...book,id:'book-verb',japanese:'予約する',meaning_context:'Please book a room.'},'to_japanese',()=>.5);
 assert.notEqual(questionKey(noun),questionKey(verb));
 const history=recordAnswer(normalizeHistory(null),noun,{correct:true,chosen:noun.answer,attempt:'noun',time:1});
 assert.ok(history.questions[questionKey(noun)]);assert.equal(history.questions[questionKey(verb)],undefined);
});
