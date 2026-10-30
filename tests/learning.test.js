import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCatalog,normalizePreferences,selectQuestions,sectionKey} from '../learning.js';
import {makeQuestionQueue} from '../game.js';
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
