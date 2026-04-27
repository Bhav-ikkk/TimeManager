/**
 * public/sw.js — TauntTable service worker.
 *
 * Strategy for delivering reminders while the page is closed
 * ----------------------------------------------------------
 * Web push without a backend is best-effort. We combine every wake-up
 * mechanism the browser will give us:
 *
 *   - `periodicsync` (Periodic Background Sync) — Android Chrome with the
 *     site installed will fire this every ~15 min – few hours.
 *   - `sync`         — fires when connectivity returns.
 *   - `message`      — the page pings us on visibility / focus / reschedule.
 *   - `setTimeout`   — while the SW lives between events, we arm a timer
 *                      pointing at the next due notification.
 *
 * Each wake reads the `pending` object store of the Dexie DB directly,
 * fires any entries whose `when` is in the past (with a small grace
 * window), removes them, and re-arms the timer for the next entry.
 */

const DB_NAME = 'taunttable';
const DB_STORE = 'pending';
const GRACE_AFTER_MS = 6 * 60 * 60 * 1000; // skip entries older than 6h
const LOOK_AHEAD_MS = 60 * 1000;            // fire up to 1 minute early

let armedTimer = null;
let armedAt = 0;

/* ----- IndexedDB helpers (raw — Dexie isn't available in the SW). ------- */

function openDB() {
  return new Promise((resolve, reject) => {
    // Don't pass a version: we want to attach to whatever Dexie created.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('idb blocked'));
  });
}

async function readAllPending() {
  let db;
  try {
    db = await openDB();
  } catch {
    return [];
  }
  if (!db.objectStoreNames.contains(DB_STORE)) {
    db.close();
    return [];
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      try { db.close(); } catch (_) { /* ignore */ }
      resolve([]);
    }
  });
}

async function deletePending(ids) {
  if (!ids || !ids.length) return;
  let db;
  try {
    db = await openDB();
  } catch {
    return;
  }
  if (!db.objectStoreNames.contains(DB_STORE)) {
    db.close();
    return;
  }
  await new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    for (const id of ids) {
      try { store.delete(id); } catch (_) { /* ignore */ }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  try { db.close(); } catch (_) { /* ignore */ }
}

/* ----- Firing logic ----------------------------------------------------- */

async function fireDue() {
  const pending = await readAllPending();
  if (!pending.length) return scheduleNext([]);

  const now = Date.now();
  const due = [];
  const stale = [];
  const remaining = [];
  for (const entry of pending) {
    if (typeof entry.when !== 'number') {
      stale.push(entry.id);
      continue;
    }
    if (entry.when <= now + LOOK_AHEAD_MS) {
      // If the user was offline / device asleep for a long stretch, drop
      // the truly stale entries so we don't carpet-bomb the tray when
      // they come back online.
      if (entry.when < now - GRACE_AFTER_MS) {
        stale.push(entry.id);
      } else {
        due.push(entry);
      }
    } else {
      remaining.push(entry);
    }
  }

  for (const entry of due) {
    try {
      await self.registration.showNotification(entry.title || 'TauntTable', {
        body: entry.body || '',
        tag: entry.tag || entry.id,
        icon: entry.icon || '/icons/icon-192.png',
        badge: entry.badge || '/icons/favicon-32.png',
        renotify: true,
        requireInteraction: false,
        data: { url: '/', pendingId: entry.id },
      });
    } catch (_) {
      /* ignore — try again next wake */
    }
  }

  await deletePending([...due.map((e) => e.id), ...stale]);
  scheduleNext(remaining);
}

function scheduleNext(remaining) {
  if (armedTimer) {
    clearTimeout(armedTimer);
    armedTimer = null;
  }
  if (!remaining.length) return;
  const next = remaining
    .map((e) => e.when)
    .filter((n) => typeof n === 'number')
    .sort((a, b) => a - b)[0];
  if (!next) return;
  const delta = Math.max(1000, next - Date.now());
  // SWs are killed when idle, so this only really helps for the first few
  // seconds after a wake — but it's free and occasionally fires.
  armedAt = next;
  armedTimer = setTimeout(() => {
    armedTimer = null;
    fireDue().catch(() => {});
  }, Math.min(delta, 0x7fffffff));
}

/* ----- Lifecycle -------------------------------------------------------- */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await fireDue();
  })());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'tt-fire-due') {
    event.waitUntil(fireDue());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'tt-fire-due') {
    event.waitUntil(fireDue());
  }
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
    return;
  }
  if (data.type === 'tt-pending-refresh') {
    event.waitUntil(fireDue());
    return;
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
