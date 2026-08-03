// GERAS service worker — the reporter must open and function with the radio
// off (CLAUDE.md §5). Precache the app shell, NetworkOnly for /api/*, and
// serve an offline fallback for navigations.

const VERSION = 'geras-v1';
const SHELL_CACHE = `${VERSION}-shell`;

const SHELL = [
  '/',
  '/report',
  '/manifest.webmanifest',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // API: always live, no cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigations: network first, fall back to /report shell then /offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match('/report')) ??
            (await cache.match('/offline.html')) ??
            new Response('offline', { status: 503, headers: { 'content-type': 'text/plain' } })
          );
        }
      })(),
    );
    return;
  }

  // Static: cache-first with background revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? fetchPromise;
    })(),
  );
});

// Background Sync where supported. Triggers reconcile on the page next time
// it's open; the actual reconcile lives in client JS because it needs IDB.
self.addEventListener('sync', (event) => {
  if (event.tag === 'geras-reconcile') {
    event.waitUntil(
      self.clients
        .matchAll({ includeUncontrolled: true, type: 'window' })
        .then((clients) =>
          clients.forEach((c) => c.postMessage({ type: 'geras:reconcile' })),
        ),
    );
  }
});
