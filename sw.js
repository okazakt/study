const CACHE = 'study-beat-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './game.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './quiz-data/junior_science.json', './music-data/index.json',
  './music-data/0001/Fallin_For_You_rhythm_beat2.json', './music-data/0001/Fallin_For_You.mp3'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('study-beat-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request.url);
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
