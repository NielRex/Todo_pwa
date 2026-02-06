const CACHE_NAME = 'todo-pwa-v4'; // Increment version
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/store.js',
  './js/utils.js', // Added new file
  './js/drag-drop.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // Force immediate activation
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
