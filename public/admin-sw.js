/* Admin Service Worker for PWA installability - v4 */
const CACHE_NAME = 'hariox-admin-v4';

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate event - claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('hariox-admin-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, no caching (SPA handles routing)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) return;
  
  // For navigation requests, let the network handle it (SPA routing)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If offline, try to return cached index
        return caches.match('/admin/dashboard') || caches.match('/');
      })
    );
    return;
  }
  
  // For other requests, just pass through
  return;
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Hariox Admin', {
        body: data.body || 'New notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'default',
      })
    );
  }
});

// Handle notification clicks - open admin dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/admin/dashboard');
      }
    })
  );
});
