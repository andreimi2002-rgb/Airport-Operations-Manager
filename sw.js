// Service worker: lets the installed app open without internet.
// - The site's own files: network first (so a new version shows up at once), the saved copy offline.
// - Game details (/api/game): network first, saved copy offline (the page says when data is saved).
// - Logos, photos, fonts: from the saved copy when there is one (they rarely change).
// - Schedule, live scores, weather, calendar feed: network only. The schedule has its own saved copy
//   in the page (localStorage), which the page labels as saved data; live scores and weather must
//   never be shown old as if they were current.
const VERSION = 'v29';   // the same in js/phone.js (APP_VERSION)
const SHELL = `shell-${VERSION}`, API = `api-${VERSION}`, IMG = `img-${VERSION}`;
const FILES = [
  '/', '/index.html', '/css/app.css', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png',
  '/js/app.js', '/js/teams.js', '/js/ui.js', '/js/ro.js', '/js/game.js', '/js/places.js', '/js/ics.js', '/js/phone.js', '/js/notify.js', '/js/teamx.js', '/js/bracket.js', '/js/leagues.js', '/js/mine.js', '/js/clubinfo.js', '/js/guide.js', '/js/core.js', '/js/home.js', '/js/pages.js', '/js/views.js', '/js/search.js', '/js/health.js', '/js/track.js', '/js/colors.js', '/js/motd.js', '/js/sharecard.js',
  '/data/places.json', '/data/snapshot.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => ![SHELL, API, IMG].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function networkFirst(req, cacheName, ms, fallback) {
  const cache = await caches.open(cacheName);
  // The download goes on after the timeout: a slow network still refreshes the saved copy for next time.
  const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
  net.catch(() => {});
  try {
    return await timeout(net, ms);
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: cacheName === SHELL && req.mode === 'navigate' });
    if (hit) return hit;
    if (fallback) { const f = await cache.match(fallback); if (f) return f; }
    throw e;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') {
    cache.put(req, r.clone());
    // Keep the image cache small: about 400 entries, oldest out first.
    cache.keys().then(keys => { if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => cache.delete(k)); });
  }
  return r;
}

// Notifications (sent by netlify/functions/push-cron.mjs): show them, and open the game page on a tap.
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = { title: 'American Sports Hub', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'American Sports Hub', {
    body: m.body || '', tag: m.tag, renotify: !!m.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    lang: 'ro', data: { url: m.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    // An open window of the app: bring it forward and show the game there.
    const w = list.find(c => new URL(c.url).origin === new URL(url, location.origin).origin);
    if (w) return w.focus().then(c => c.navigate ? c.navigate(url) : c);
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    if (u.pathname === '/sw.js') return;                              // the page reads the published version
    if (u.pathname === '/api/game' || u.pathname === '/api/team') { e.respondWith(networkFirst(req, API, 8000)); return; }
    if (u.pathname.startsWith('/api/')) return;                       // network only
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, 5000, '/index.html')); return; }
    e.respondWith(networkFirst(req, SHELL, 5000));
    return;
  }
  if (/(^|\.)espncdn\.com$|(^|\.)wikimedia\.org$|^fonts\.(gstatic|googleapis)\.com$/.test(u.hostname)) {
    e.respondWith(cacheFirst(req).catch(() => Response.error()));
  }
});
