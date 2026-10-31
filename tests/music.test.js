import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionMusic,musicCredit,seededRandom,sessionPlan,easyEvents} from '../game.js';
const entry=(id,duration=100)=>({id,track:{title:id,creator:'artist',durationSeconds:duration,files:{audio:id+'.mp3'},timing:{chartToAudioOffsetMs:25}},chart:{events:[{time:1,type:'beat',bar:1,beatInBar:1}]}});
test('random music fills the session, shuffles without repetition per bag and keeps continuous adjusted events',()=>{
 const entries=['a','b','c'].map(id=>entry(id)),first=new Set();
 for(let seed=1;seed<100;seed++){
  const p=sessionMusic(entries,'',seededRandom(seed*100003),650);first.add(p.tracks[0].id);
  assert.ok(p.duration>=650);assert.ok(p.duration-p.tracks.at(-1).durationSeconds<650);
  assert.equal(new Set(p.tracks.slice(0,3).map(t=>t.id)).size,3);
  assert.equal(new Set(p.tracks.slice(3,6).map(t=>t.id)).size,3);
  for(let i=1;i<p.tracks.length;i++){assert.notEqual(p.tracks[i].id,p.tracks[i-1].id);assert.equal(p.tracks[i].start,i*100);}
  assert.equal(p.events[1].time,101.025);assert.equal(easyEvents(p.events).length,p.tracks.length);assert.equal(sessionPlan(p.duration).endTime,300);
 }
 assert.equal(first.size,3);
});
test('fixed music repeats to five minutes and missing saved songs fall back to random',()=>{
 const entries=[entry('a',139),entry('b',234)];
 const p=sessionMusic(entries,'a');assert.deepEqual(p.tracks.map(t=>t.id),['a','a','a']);assert.equal(p.duration,417);
 assert.ok(sessionMusic(entries,'removed').duration>=300);assert.equal(sessionMusic([entry('a')]).tracks.length,3);
 assert.deepEqual(sessionMusic([]).tracks,[]);
});
test('credit instructions are preserved verbatim; unspecified or blank credits show title and creator',()=>{
 const track={title:'Song',creator:'Artist'};
 assert.equal(musicCredit(track),'Song / Artist');assert.equal(musicCredit({...track,creditText:'  '}),'Song / Artist');
 assert.equal(musicCredit({...track,creditText:'Song by Artist\nLicense: supplied text'}),'Song by Artist\nLicense: supplied text');
});
