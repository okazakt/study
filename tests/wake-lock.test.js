import test from 'node:test';
import assert from 'node:assert/strict';
import {ScreenWakeLock} from '../wake-lock.js';
class Lock extends EventTarget{released=false;async release(){this.released=true;this.dispatchEvent(new Event('release'));}}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('screen stays awake only while enabled, reuses a held lock, and releases on exit',async()=>{
 let calls=0;const lock=new Lock(),c=new ScreenWakeLock({async request(type){assert.equal(type,'screen');calls++;return lock;}});
 assert.equal(await c.setEnabled(true),true);assert.equal(await c.setEnabled(true),true);assert.equal(calls,1);
 await c.setEnabled(false);assert.ok(lock.released);assert.equal(c.lock,null);
});
test('leaving while the request is pending releases the eventual lock',async()=>{
 let resolve;const lock=new Lock(),c=new ScreenWakeLock({request:()=>new Promise(r=>resolve=r)});
 const pending=c.setEnabled(true);await tick();await c.setEnabled(false);resolve(lock);assert.equal(await pending,false);assert.ok(lock.released);assert.equal(c.lock,null);
});
test('an old request cannot replace the lock of a newly started session',async()=>{
 const pending=[],c=new ScreenWakeLock({request:()=>new Promise(resolve=>pending.push(resolve))});
 const first=c.setEnabled(true);await tick();await c.setEnabled(false);const second=c.setEnabled(true);await tick();
 const old=new Lock(),current=new Lock();pending[1](current);await second;pending[0](old);await first;
 assert.ok(old.released);assert.equal(c.lock,current);assert.equal(current.released,false);await c.setEnabled(false);
});
test('an unexpected release reacquires during visible play but never after exit',async()=>{
 const locks=[],c=new ScreenWakeLock({async request(){const lock=new Lock();locks.push(lock);return lock;}});
 await c.setEnabled(true);await locks[0].release();await tick();assert.equal(locks.length,2);assert.equal(c.lock,locks[1]);
 await c.setEnabled(false);await tick();assert.equal(locks.length,2);
});
test('unsupported, denied or hidden requests do not break play or retry in a loop',async()=>{
 assert.equal(await new ScreenWakeLock(null).setEnabled(true),false);
 let calls=0;const c=new ScreenWakeLock({async request(){calls++;throw new Error('denied');}});
 assert.equal(await c.setEnabled(true),false);await tick();assert.equal(calls,1);
 const hidden=new ScreenWakeLock({async request(){throw new Error('must not request')}},()=>false);assert.equal(await hidden.setEnabled(true),false);
});
