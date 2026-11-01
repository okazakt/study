const VERSION = '0.44.3';
const CACHE = 'study-beat-v0.44.3';
const MEDIA = 'study-beat-media-v1';
const versioned = path => `${path}?v=${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  ...['./style.css', './app.js', './game.js', './music-player.js', './wake-lock.js', './learning.js', './progress.js', './calibration.js', './quiz-data/junior_science.json', './quiz-data/junior_english.json', './quiz-data/junior_japanese.json', './quiz-data/junior_math.json', './quiz-data/junior_social.json', './music-data/index.json',
    './music-data/0001/Fallin_For_You_rhythm_beat2.json', './music-data/0002/the_mountain_rhythm_beat2.json'].map(versioned)];
const AUDIO = ['./music-data/0001/Fallin_For_You.mp3', './music-data/0002/the_mountain-american-western-country-496543.mp3'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function notify(type) { for (const client of await self.clients.matchAll()) client.postMessage({ type }); }
let mediaJob;
async function saveMedia() {
  await notify('MEDIA_LOADING');
  try {
    const cache = await caches.open(MEDIA);
    for (const path of AUDIO) {
      const url = new URL(path, self.location.href).href;
      if (await cache.match(url)) continue;
      const previous = await caches.match(url);
      const response = previous || await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok || response.status === 206) throw new Error('Incomplete audio');
      await cache.put(url, response);
    }
    // Another tab may already be installing a later release. Keep its cache.
    for (const key of await caches.keys()) {
      const match = /^study-beat-v(\d+)\.(\d+)\.(\d+)$/.exec(key);
      if (!match) continue;
      const old = match.slice(1).map(Number), current = VERSION.split('.').map(Number);
      const different = old.findIndex((part, index) => part !== current[index]);
      if (different >= 0 && old[different] < current[different]) await caches.delete(key);
    }
    await notify('MEDIA_READY');
  } catch { await notify('MEDIA_ERROR'); }
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_MEDIA') return;
  if (!mediaJob) mediaJob = saveMedia().finally(() => { mediaJob = null; });
  event.waitUntil(mediaJob);
});
async function pageResponse(request, cache) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }), { signal: controller.signal });
    if (response.ok) return response;
  } catch { /* Use the complete installed app when offline. */ }
  finally { clearTimeout(timeout); }
  const stored = await cache.match(new URL('./index.html', self.location.href).href);
  if (!stored) return Response.error();
  const headers = new Headers(stored.headers); headers.set('X-Study-Offline', '1');
  return new Response(stored.body, { status: stored.status, headers });
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const home = new URL('./', self.location.href);
    const isPage = event.request.mode === 'navigate' || (url.searchParams.has('update') && [home.pathname, `${home.pathname}index.html`].includes(url.pathname));
    if (isPage) return pageResponse(event.request, cache);
    const media = await caches.open(MEDIA);
    const cached = await cache.match(event.request.url) || await media.match(event.request.url);
    if (!cached) return fetch(event.request);
    const range = event.request.headers.get('range');
    if (!range) return cached;
    // Cached MP3 is a full response. Mobile browsers may request partial audio offline.
    const bytes = await cached.arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg', 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`, 'Content-Length': String(end - start + 1)
    } });
  })());
});
