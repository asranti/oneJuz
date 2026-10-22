// Service Worker for SatuJuz PWA
const CACHE_NAME = 'satujuz-v45';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './data/quran_metadata.js',
  './js/api.js',
  './js/audio-player.js',
  './js/history-manager.js',
  './js/app.js',
  './data/juz30_data.js',
  './data/juz30_surahs.json',
  './data/verses_juz30.json',
  './fonts/LPMQ-IsepMisbah.ttf',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png',
  './icons/history-icon.png',
  './icons/history-icon-64.png',
  './icons/progress-icon.png',
  './icons/progress-icon-64.png',
  './icons/latihan-icon.png',
  './icons/latihan-icon-64.png',
  './icons/setoran-icon.png',
  './icons/setoran-icon-64.png',
  './icons/settings-icon.png',
  './icons/settings-icon-64.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through for audio streams and non-GET requests
  if (event.request.method !== 'GET' || event.request.url.includes('verses.quran.com') || event.request.url.includes('audio.qurancdn.com') || event.request.url.includes('everyayah.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache external API responses dynamically if needed
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
