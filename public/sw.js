/**
 * CivicLens Service Worker — Offline-First Caching
 *
 * Caches app shell (HTML, CSS, JS, vendor libs) on install so the
 * app loads even without a network connection.  API calls use a
 * network-first strategy so live data is always preferred.
 */

const CACHE_NAME = 'civiclens-v1';

/** App-shell assets cached on install */
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/favicon.svg',
  '/icons.js',
  '/civic-utils.js',
  '/app.js',
  '/staff-ops.js',
  '/insights.js',
  '/nlp-dashboard.js',
  '/civic-map.js',
  '/service-portal.js',
  '/report-generator.js',
  '/demo-mode.js',
  '/demo-overlay.js',
  '/vendor/marked.min.js',
  '/vendor/purify.min.js',
  '/vendor/chart.js',
  '/vendor/leaflet.js',
  '/vendor/leaflet.css',
];

// ─── Install: pre-cache app shell ───────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ─────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first for API, cache-first for assets ──────────────────

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST to /api/chat, etc.)
  if (event.request.method !== 'GET') return;

  // API calls: network-first with no cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ error: 'You are offline. Some features require a network connection.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Static assets: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful same-origin responses for future offline use
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Ultimate fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
