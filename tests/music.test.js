import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlaylist,sessionMusic,normalizeMusicSelection,musicCredit,seededRandom,sessionPlan,easyEvents,trackPlaybackBounds} from '../game.js';
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

test('selected songs shuffle only within the saved subset, without repeat before exhausting it',()=>{
 const entries=['a','b','c','d'].map(id=>entry(id));const first=new Set();
 for(let seed=1;seed<=40;seed++){
  const p=sessionMusic(entries,['b','d'],seededRandom(seed*100003),650);
  first.add(p.tracks[0].id);
  assert.ok(p.tracks.every(t=>['b','d'].includes(t.id)));
  for(let i=1;i<p.tracks.length;i++)assert.notEqual(p.tracks[i-1].id,p.tracks[i].id);
 }
 assert.equal(first.size,2);
 assert.deepEqual(sessionMusic(entries,['c']).tracks.map(t=>t.id),['c','c','c']);
});
test('saved music selection migrates legacy fixed songs and handles missing or duplicate IDs',()=>{
 assert.deepEqual(normalizeMusicSelection('a',['a','b']),['a']);
 assert.deepEqual(normalizeMusicSelection(['b','b','removed'],['a','b']),['b']);
 for(const value of [null,'',[],['removed'],{},4])assert.equal(normalizeMusicSelection(value,['a','b']),null);
 assert.ok(sessionMusic([entry('a')],['removed']).duration>=300);
});

test('edge silence trims audio and chart once while retaining song/device offsets and continuous boundaries',()=>{
 const a=entry('a',100),b=entry('b',100);a.track.playback={startSeconds:0,endSeconds:98};b.track.playback={startSeconds:.7,endSeconds:97};
 const p=sessionMusic([a,b],['a','b'],()=>.99,300);
 assert.equal(p.tracks[1].start,98);assert.equal(p.tracks[1].mediaStart,.7);assert.equal(p.tracks[1].durationSeconds,96.3);
 assert.ok(Math.abs(p.tracks[1].events[0].time-(98+1+.025-.7))<1e-9);
 assert.ok(p.duration>=300);assert.equal(p.tracks.length,4);
 const raw=makePlaylist([a,b],{trim:false});assert.equal(raw.tracks[1].start,100);assert.equal(raw.tracks[1].mediaStart,0);assert.equal(raw.tracks[1].events[0].time,101.025);
 assert.deepEqual(trackPlaybackBounds({...a.track,playback:{startSeconds:99,endSeconds:10}}),{start:0,end:100,duration:100});
});
