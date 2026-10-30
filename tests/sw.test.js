import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const base = 'https://example.test/study/';
function worker() {
  const listeners = {}, stores = new Map(), calls = [], messages = [];
  let online = true, failAudio = false, skipped = false;
  const key = input => new URL(typeof input === 'string' ? input : input.url, base).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(input) { return store.get(key(input))?.clone(); },
        async put(input, response) { store.set(key(input), response.clone()); },
        async addAll(inputs) { for (const input of inputs) await this.put(input, await network(input)); }
      };
    },
    async match(input) { for (const name of stores.keys()) { const found = await (await this.open(name)).match(input); if (found) return found; } },
    async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); }
  };
  async function network(input) {
    const url = key(input); calls.push({url, cache:input.cache});
    if (!online || (failAudio && url.endsWith('.mp3'))) throw new Error('offline');
    return new Response(url.endsWith('.mp3') ? '0123456789' : url.includes('index.html') || url === base || url.includes('?update=') ? 'latest page' : 'asset');
  }
  class WebRequest extends Request { constructor(input, init) { super(typeof input === 'string' ? key(input) : input, init); } }
  const self = { location: new URL('sw.js', base), addEventListener(type, callback) { listeners[type] = callback; },
    async skipWaiting() { skipped = true; }, clients: { async claim() {}, async matchAll() { return [{ postMessage(data) { messages.push(data.type); } }]; } } };
  vm.runInNewContext(source, { self, caches, fetch:network, Request:WebRequest, Response, Headers, URL, AbortController, setTimeout, clearTimeout });
  return { calls, messages, caches, online(value) { online = value; }, failAudio(value) { failAudio = value; }, get skipped() { return skipped; },
    async run(type, properties = {}) { let result; listeners[type]({...properties, waitUntil(p) { result = p; }, respondWith(p) { result = p; }}); return await result; },
    async request(path, init) { return this.run('fetch', { request: new WebRequest(path, init) }); } };
}
test('app installation activates without downloading audio, including when audio fails', async () => {
  const w = worker(); w.failAudio(true); await w.run('install'); await w.run('activate');
  assert.equal(w.skipped,true); assert.ok(!w.calls.some(call => call.url.endsWith('.mp3')));
  await w.run('message',{data:{type:'CACHE_MEDIA'}}); assert.ok(w.messages.includes('MEDIA_ERROR'));
  assert.ok(await (await w.caches.open('study-beat-v0.13.1')).match('app.js?v=0.13.1'));
});
test('navigation obtains network page without HTTP cache and falls back offline for query URLs', async () => {
  const w = worker(); await w.run('install');
  const response = await w.request('?update=123'); assert.equal(await response.text(),'latest page'); assert.equal(w.calls.at(-1).cache,'no-store');
  w.online(false); const offline = await w.request('?update=456');
  assert.equal(offline.headers.get('X-Study-Offline'),'1');assert.equal(await offline.text(),'latest page');
});
test('audio migrates from previous cache, survives cleanup and serves offline byte ranges', async () => {
  const w = worker(), old = await w.caches.open('study-beat-v0.11.0');
  for(const path of ['music-data/0001/Fallin_For_You.mp3','music-data/0002/the_mountain-american-western-country-496543.mp3']) await old.put(path,new Response('0123456789'));
  await w.caches.open('study-beat-v0.14.0');
  await w.run('install'); w.online(false); await w.run('message',{data:{type:'CACHE_MEDIA'}});
  assert.ok((await w.caches.keys()).includes('study-beat-v0.14.0'));
  assert.equal(w.messages.at(-1),'MEDIA_READY');assert.ok(!(await w.caches.keys()).includes('study-beat-v0.11.0'));
  const response=await w.request('music-data/0002/the_mountain-american-western-country-496543.mp3',{headers:{Range:'bytes=2-5'}});
  assert.equal(response.status,206);assert.equal(await response.text(),'2345');assert.equal(response.headers.get('Content-Range'),'bytes 2-5/10');
});
test('public version and versioned app references agree',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');const version=JSON.parse(read('package.json')).version;
  assert.ok(read('index.html').includes(`v${version}`));
  for(const file of ['style.css','app.js'])assert.ok(read('index.html').includes(`${file}?v=${version}`));
  assert.ok(read('app.js').includes(`game.js?v=${version}`));
  for(const file of ['sw.js','app.js'])assert.ok(read(file).includes(`const VERSION = '${version}'`));
  assert.ok(source.includes(`study-beat-v${version}`));assert.equal(JSON.parse(read('version.json')).version,version);
});
