/**
 * public/sw.js — TauntTable service worker.
 *
 * Responsibilities:
 *   1. Become the controller as soon as it activates.
 *   2. Show notifications when the page asks (via postMessage) so reminders
 *      survive briefly even while the page is backgrounded.
 *   3. Focus / open the app when a notification is clicked.
 *
 * We deliberately keep this tiny and stateless — scheduling is done in the
 * foreground so we can use live IndexedDB queries and re-schedule on edits.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-notification') {
    const { title, body, tag, icon, badge } = data;
    event.waitUntil(
      self.registration.showNotification(title || 'TauntTable', {
        body: body || '',
        tag: tag || 'taunttable',
        icon: icon || '/icons/icon-192.png',
        badge: badge || '/icons/favicon-32.png',
        renotify: true,
        requireInteraction: false,
        data: { url: '/' },
      })
    );
  }
  if (data.type === 'ping') {
    event.source && event.source.postMessage({ type: 'pong' });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })()
  );
});
