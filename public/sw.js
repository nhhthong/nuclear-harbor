/*
 * Last Stand: Nuclear Harbor - offline service worker (T-17, GDD 14).
 * Hand-written, no dependencies, no network use beyond fetching the game's own files.
 * The two constants below are filled at build time by the Vite plugin in vite.config.ts
 * (version = hash of the build, PRECACHE = every built file including the GLB).
 *
 * Strategy: precache everything on install; cache-first for same-origin GET (search string
 * ignored so ?autostart etc. hit the cached page); old versioned caches removed on activate.
 */
const VERSION = 'dev';
const PRECACHE = [];
const CACHE_PREFIX = 'nh-';
const CACHE = CACHE_PREFIX + VERSION;
const IMMUTABLE = /-[A-Za-z0-9_-]{8}\.(js|css)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, self.registration.scope);
          // content-hashed build files never change under the same name: reuse them from an older cache
          if (IMMUTABLE.test(path)) {
            const old = await caches.match(url);
            if (old) {
              await cache.put(url, old);
              return;
            }
          }
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!response.ok) throw new Error('precache failed: ' + url.pathname + ' ' + response.status);
          await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch (error) {
        // offline and not cached: a navigation falls back to the cached game page
        if (request.mode === 'navigate') {
          const page = await cache.match(new URL('./', self.registration.scope), { ignoreSearch: true, ignoreVary: true });
          if (page) return page;
        }
        throw error;
      }
    })(),
  );
});
