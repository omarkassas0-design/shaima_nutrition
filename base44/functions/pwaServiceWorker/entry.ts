/**
 * PWA Service Worker — served via backend function.
 *
 * Chrome requires a registered service worker with a fetch handler
 * to show the "Install" prompt (not "Create shortcut").
 *
 * The platform does not serve custom static files from public/,
 * so we serve the SW JavaScript through this backend function.
 * The Service-Worker-Allowed: / header lets the SW control the root
 * scope even though it's served from /functions/pwaServiceWorker.
 *
 * This endpoint is public (no auth) — it returns static JS, like a webhook.
 *
 * PRIVACY: the Cache API matches on URL only — Authorization headers are NOT
 * part of the cache key. Caching authenticated API responses would therefore
 * serve one user's data to the next account on the same browser profile. This
 * worker caches ONLY same-origin, unauthenticated static assets; API/function
 * traffic and JSON payloads are never cached nor served from cache.
 */
export default async function (req) {
  const swCode = `
const CACHE = 'auradental-shell-v1';

// Paths that carry authenticated data — never cache or serve from cache.
const NEVER_CACHE_PREFIXES = ['/functions/', '/api/', '/auth/'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Let the app clear the cache on logout.
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(caches.delete(CACHE));
  }
});

// A request may be cached ONLY when it is a same-origin, unauthenticated,
// non-API static asset. Everything else is left to the network untouched.
function isCacheableAsset(req, url) {
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (req.headers.get('authorization')) return false;
  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
  const dest = req.destination;
  return dest === 'script' || dest === 'style' || dest === 'image' || dest === 'font';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Navigation requests: network-first, fallback to the cached app shell.
  // The shell document contains no user data.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Only static assets are cached. API / function / authenticated requests
  // and dynamic JSON are never intercepted, so no user data enters the cache.
  if (!isCacheableAsset(req, url)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          const ct = (res && res.headers.get('content-type')) || '';
          if (res && res.status === 200 && !ct.includes('application/json')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
`;

  return new Response(swCode, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache",
    },
  });
}