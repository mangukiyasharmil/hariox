/* Minimal SW for PWA installability (no caching) */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// no-op fetch handler (keeps PWA requirements without changing runtime behavior)
self.addEventListener("fetch", () => {});
