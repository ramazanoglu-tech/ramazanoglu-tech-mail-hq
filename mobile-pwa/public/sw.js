// =============================================================================
// RAMAZANOĞLU TECH MAIL HQ - SERVICE WORKER
// =============================================================================

// Bumped on purpose: v1.0 caches contain the old app.js that embedded the admin key
const CACHE_NAME = 'rt-mail-hq-v1.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './tailwind.css',
  './auth.css',
  './app.js',
  './auth.js',
  './admin.html',
  './admin.css',
  './admin.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static Swiss app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let API requests pass directly to cloud server
  if (event.request.url.includes('/api/') || event.request.url.includes('/ws')) {
    return;
  }

  // Network-first so a new deploy (or a security fix) is never masked by a stale cached app shell
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Ramazanoğlu Tech Mail HQ';
  const options = {
    body: data.body || 'Yeni kurumsal e-posta alındı.',
    icon: './icon.svg',
    badge: './icon.svg',
    data: data.url || './',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
