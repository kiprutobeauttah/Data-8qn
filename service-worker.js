/* Author: Beauttah | Meru University | Data-8qn
   Simple service worker to cache app shell for offline use */

const CACHE_NAME = 'data-8qn-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/visualize.html',
  '/developers.html',
  '/assets/style.css',
  '/assets/script.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).catch(()=> caches.match('/index.html'))));
});
