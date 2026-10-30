import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCatalog,normalizePreferences,selectQuestions,sectionKey,practiceTypes,matchesPracticeQuestion} from '../learning.js';
import {Game,makeQuestionQueue} from '../game.js';
const read=name=>JSON.parse(readFileSync(new URL('../quiz-data/'+name+'.json',import.meta.url)));
const items=[...read('junior_science'),...read('junior_english'),...read('junior_japanese')],catalog=buildCatalog(items);
const course=id=>catalog.find(c=>c.id===id);
test('catalog exposes actual grade coverage and keeps absent grades and high school unavailable',()=>{
 assert.equal(course('中学:理科:3').count,89);assert.equal(course('中学:国語:3').count,38);assert.equal(course('中学:英語:2').count,32);
 assert.equal(course('中学:理科:1').count,0);assert.equal(course('中学:理科:2').count,0);
 assert.ok(catalog.filter(c=>c.school==='高校').every(c=>c.count===0));
 assert.deepEqual(course('中学:理科:exam').grades,['中3']);assert.equal(course('中学:理科:exam').count,89);
 assert.equal(course('中学:理科:3').sections.length,5);assert.equal(course('中学:英語:2').sections.length,2);
});
test('saved school and sections survive normalization while unavailable or foreign-school scopes are rejected',()=>{
 const science=course('中学:理科:3'),key=science.sections[0].key;
 const raw={school:'中学',profiles:{中学:{id:science.id,sections:[key,'deleted-unit',key]},高校:{id:science.id,sections:null}}};
 const saved=normalizePreferences(JSON.parse(JSON.stringify(raw)),catalog);
 assert.equal(saved.school,'中学');assert.deepEqual(saved.profiles['中学'].sections,[key]);assert.equal(saved.profiles['高校'],null);
 assert.equal(normalizePreferences({school:'college'},catalog).school,'');
 assert.equal(normalizePreferences({school:'中学',profiles:{中学:{id:'中学:理科:1'}}},catalog).profiles['中学'],null);
});
test('course and section filtering limits the actual generated questions without silent fallback',()=>{
 const science=course('中学:理科:3'),unit=science.sections[0];
 const chosen=selectQuestions(items,'中学',{id:science.id,sections:[unit.key]},catalog);
 assert.equal(chosen.length,unit.count);assert.ok(chosen.every(q=>sectionKey(q)===unit.key));
 const queue=makeQuestionQueue(chosen);assert.ok(queue.length>0);assert.ok(queue.every(q=>q.subject==='理科'&&sectionKey(q)===unit.key));
 assert.deepEqual(selectQuestions(items,'中学',{id:science.id,sections:[]},catalog),[]);
 assert.deepEqual(selectQuestions(items,'高校',{id:science.id,sections:null},catalog),[]);
 assert.deepEqual(selectQuestions(items,'',null,catalog),[]);
 const exam=selectQuestions(items,'中学',{id:'中学:理科:exam',sections:null},catalog);
 assert.equal(exam.length,89);assert.equal(new Set(exam.map(q=>q.id)).size,89);
 const english=selectQuestions(items,'中学',{id:'中学:英語:2',sections:null},catalog);assert.equal(english.length,32);assert.ok(english.every(q=>q.subject==='英語'));
});

function practiceQueue(id,type){
 const entry={id,sections:null,practiceType:type};const selected=selectQuestions(items,'中学',entry,catalog);
 return new Game(selected,[],0,()=>.5,Infinity,q=>matchesPracticeQuestion(q,type)).questions;
}
test('Japanese and English menus include every requested type with all as a distinct choice',()=>{
 assert.deepEqual(practiceTypes('国語').map(t=>t.label),['漢字書き','漢字読み','熟語','現代文法','古文','漢文','全て']);
 assert.deepEqual(practiceTypes('英語').map(t=>t.label),['単語和英','単語英和','単語綴り','熟語和英','熟語英和','全て']);
});
test('Japanese practice filters remove the other kanji direction and keep both grammar and idiom directions',()=>{
 const specs=[['kanji_write',12,['kanji_component']],['kanji_read',12,['kanji_reading']],['idiom',16,['japanese_term','japanese_definition']],
 ['modern',12,['explanation_to_term','term_to_explanation']],['classical',12,['explanation_to_term','term_to_explanation']],['kanbun',12,['explanation_to_term','term_to_explanation']],['all',76,null]];
 for(const [type,count,modes] of specs){const queue=practiceQueue('中学:国語:3',type);assert.equal(queue.length,count);assert.ok(queue.every(q=>matchesPracticeQuestion(q,type)));if(modes)assert.deepEqual(new Set(queue.map(q=>q.mode)),new Set(modes));}
 assert.ok(practiceQueue('中学:国語:3','modern').every(q=>q.field==='現代文文法'));
 assert.ok(practiceQueue('中学:国語:3','classical').every(q=>q.field==='古文文法'));
 assert.ok(practiceQueue('中学:国語:3','kanbun').every(q=>q.field==='漢文文法'));
});
test('English practice filters enforce word versus phrase and Japanese versus English direction',()=>{
 for(const [type,count,mode] of [['word_ja_en',24,'to_english'],['word_en_ja',24,'to_japanese'],['word_spelling',62,'spelling'],['phrase_ja_en',8,'to_english'],['phrase_en_ja',8,'to_japanese']]){
  const queue=practiceQueue('中学:英語:2',type);assert.equal(queue.length,count);assert.ok(queue.every(q=>q.mode===mode));
  assert.ok(queue.every(q=>(q.field==='熟語')===type.startsWith('phrase')));
  for(const [i,q] of queue.entries()){
   if(mode==='to_english'){assert.equal(q.prompt,q.japanese);assert.equal(q.answer,q.english);}
   if(mode==='to_japanese'){assert.equal(q.prompt,q.english);assert.equal(q.answer,q.japanese);}
   if(q.continuation){assert.equal(queue[i-1].sourceId,q.sourceId);assert.equal(queue[i-1].blankPosition,q.blankPosition-1);}
  }
 }
 assert.equal(practiceQueue('中学:英語:2','all').length,147);
});
test('practice choice is persisted and legacy or invalid choices default to all',()=>{
 const saved=normalizePreferences({school:'中学',profiles:{中学:{id:'中学:英語:2',sections:null,practiceType:'word_en_ja'}}},catalog);
 assert.equal(JSON.parse(JSON.stringify(saved)).profiles['中学'].practiceType,'word_en_ja');
 for(const type of [undefined,'missing','kanji_write'])assert.equal(normalizePreferences({school:'中学',profiles:{中学:{id:'中学:英語:2',sections:null,practiceType:type}}},catalog).profiles['中学'].practiceType,'all');
});
