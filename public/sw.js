// Minimal service worker for installability only.
//
// SECURITY: this is a credentials vault — the worker intentionally does NOT
// cache any requests or responses, so no secrets are ever written to the Cache
// Storage on disk. Its only job is to exist with a fetch handler so the browser
// treats the app as installable. All requests pass straight through to network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Network passthrough — no respondWith(), no caching.
});
