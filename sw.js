// Offline support: cache the app shell, serve from cache first, refresh in the background.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'lift-v48';
const IMG_CACHE = 'lift-img-v1'; // exercise photos, cached as they're viewed
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/store.js',
  './js/engine.js',
  './js/plan.js',
  './js/chart.js',
  './js/bank.js',
  './js/fatigue.js',
  './js/cardio.js',
  './js/cardio-bank.js',
  './js/builder.js',
  './js/science.js',
  './js/crypto.js',
  './js/gym.js',
  './js/records.js',
  './js/nutrition.js',
  './js/foods.js',
  './js/year.js',
  './js/exercise-info.js',
  './js/ui-food.js',
  './js/ui-year.js',
  './js/ui-extra.js',
  './js/drag.js',
  './js/icons.js',
  './js/body.js',
  './js/morph.js',
  './js/review.js',
  './js/tour.js',
  './js/units.js',
  './js/gestures.js',
  './js/account.js',
  './js/sync.js',
  './js/ui-account.js',
  './js/card.js',
  './js/ui-people.js',
  './js/push.js',
  './js/screen-progress.js',
  './js/screen-workout.js',
  './js/screen-plan.js',
  './js/screen-builder.js',
  './js/blocks.js',
  './js/conditioning.js',
  './js/cloud.js',
  './js/ui-cloud.js',
  './js/energy.js',
  './js/pain.js',
  './js/ui-pain.js',
  './js/week.js',
  './js/recovery.js',
  './js/running.js',
  './js/ui-train.js',
  './js/variety.js',
  './js/swipe.js',
  './js/ui-focus.js',
  './js/ui-exercise.js',
  './js/core.js',
  './js/warmcool.js',
  './js/groups.js',
  './js/ui-plantools.js',
  './js/goals.js',
  './js/health.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Exercise photos from free-exercise-db: cache-first so they work offline once seen.
  if (req.method === 'GET' && url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith('/yuhonas/free-exercise-db/')) {
    e.respondWith(caches.open(IMG_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(network); return cached; }
      const res = await network;
      return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }),
  );
});

// ---------- Notifications (web push from the Lift server, cloud/push.js) ----------
self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Lift', {
    body: m.body || '',
    tag: m.tag || undefined,
    renotify: !!m.tag,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: { url: m.url || './' },
  }));
});

// Tapping a notification opens the app (or brings it forward) where the notification points.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ type: 'open', url: target }); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
