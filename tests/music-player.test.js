import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayer} from '../music-player.js';
function setup(){
 const starts=[],stops=[],ramps=[];let decodes=0;
 const context={currentTime:10,createBufferSource(){return{connect(){},disconnect(){},start(...args){starts.push(args)},stop(){stops.push(true)}}},createGain(){return{connect(){},disconnect(){},gain:{setValueAtTime(...a){ramps.push(a)},linearRampToValueAtTime(...a){ramps.push(a)}}}},async decodeAudioData(){decodes++;return {duration:200}}};
 const tracks=[{start:0,durationSeconds:98,mediaStart:0,files:{audio:'a.mp3'}},{start:98,durationSeconds:96.3,mediaStart:.7,files:{audio:'b.mp3'}},{start:194.3,durationSeconds:98,mediaStart:0,files:{audio:'a.mp3'}},{start:292.3,durationSeconds:96.3,mediaStart:.7,files:{audio:'b.mp3'}}];
 const player=new MusicPlayer(context,{}),playlist={tracks};const fetchAudio=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
 return {player,playlist,context,starts,stops,ramps,fetchAudio,get decodes(){return decodes}};
}
test('music is decoded in advance and sources are scheduled contiguously, with trims and final cutoff',async()=>{
 const s=setup();await s.player.prepare(s.playlist,s.fetchAudio);assert.equal(s.decodes,2);
 s.player.start(s.playlist,300);assert.equal(s.starts.length,4);assert.equal(s.starts[1][1],.7);
 for(let i=1;i<s.starts.length;i++)assert.ok(Math.abs(s.starts[i][0]-s.starts[i-1][0]-s.starts[i-1][2])<1e-9);
 assert.ok(Math.abs(s.starts.at(-1)[0]+s.starts.at(-1)[2]-310.05)<1e-9);
 assert.equal(s.player.time,0);s.context.currentTime=30.05;assert.equal(s.player.time,20);
 s.player.stop();assert.equal(s.stops.length,4);assert.equal(s.player.running,false);s.context.currentTime=40;assert.equal(s.player.time,20);
});
test('replay reuses decoded buffers and stops all previously scheduled music before restarting',async()=>{
 const s=setup();await s.player.prepare(s.playlist,s.fetchAudio);s.player.start(s.playlist,300);
 await s.player.prepare(s.playlist,s.fetchAudio);assert.equal(s.decodes,2);s.player.start(s.playlist,300);assert.equal(s.stops.length,4);
 s.player.stop();assert.equal(s.stops.length,8);
 await s.player.prepare({tracks:[s.playlist.tracks[0]]},s.fetchAudio);assert.equal(s.player.buffers.size,1);
});
test('music download failure prevents scheduling an incomplete playlist',async()=>{
 const s=setup();await assert.rejects(s.player.prepare(s.playlist,async()=>({ok:false})),/download failed/);assert.equal(s.starts.length,0);assert.equal(s.player.running,false);
});
