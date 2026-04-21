/**
 * src/lib/notifications.js
 * Reminder scheduler for TauntTable.
 *
 * Reliability strategy
 * --------------------
 * Web Notifications without a paid push service are inherently best-effort.
 * To get them as close to "always on time" as possible we combine three
 * mechanisms, in order of preference:
 *
 *   1. **TimestampTrigger** (Chrome / Edge with Notification Triggers).
 *      We hand the OS a future timestamp via `showNotification({ showTrigger })`
 *      and the browser fires it at that exact time even if the tab is closed.
 *
 *   2. **setTimeout** queued in the foreground page. Works while the page is
 *      open or briefly backgrounded.
 *
 *   3. A fresh reschedule on every visibilitychange / focus / online event,
 *      and at midnight, so we catch up immediately when the user reopens
 *      the app.
 *
 * Re-scheduling is idempotent. We track timer IDs in a module-level Map keyed
 * by `${dateKey}::${taskId}::${variant}` so duplicates can't pile up. Trigger-
 * based notifications are deduped by `tag` (the SW will replace by tag).
 */
import { getDB, isTaskOnDate, todayKey, completionId, getCustomQuotes, getFavoriteQuotes } from './db';
import { pickQuote, pickQuoteAsync, QUOTES } from './quotes';

const SW_PATH = '/sw.js';

// Settings keys
const MORNING_ALARM_KEY = 'morning-alarm-time'; // "HH:mm"
const PREFS_KEY = 'notification-prefs';

const DEFAULT_MORNING_ALARM = '07:00';

// Default daily quote times (when the user has the "daily quotes" toggle on).
export const DEFAULT_QUOTE_TIMES = ['08:30', '13:30', '20:30'];

export const DEFAULT_PREFS = {
  taskReminders: true,
  morningAlarm: true,
  dailyQuotes: true,
  quoteTimes: DEFAULT_QUOTE_TIMES,
};

/** taskKey -> setTimeout id  */
const timers = new Map();

/* -------------------------------------------------------------------------- */
/* Permission + service worker registration                                    */
/* -------------------------------------------------------------------------- */

export function notificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export function notificationStatus() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

let _swReg = null;
async function ensureServiceWorker() {
  if (!notificationsSupported()) return null;
  if (_swReg) return _swReg;
  try {
    _swReg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
    await navigator.serviceWorker.ready;
    return _swReg;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('SW registration failed', e);
    return null;
  }
}

function triggersSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'showTrigger' in Notification.prototype
  );
}

/* -------------------------------------------------------------------------- */
/* Showing a notification                                                      */
/* -------------------------------------------------------------------------- */

async function showNotificationNow({ title, body, tag }) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const reg = await ensureServiceWorker();
  const payload = {
    type: 'show-notification',
    title,
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
  };
  if (reg && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(payload);
    return;
  }
  if (reg) {
    try {
      await reg.showNotification(title, {
        body,
        tag,
        icon: payload.icon,
        badge: payload.badge,
      });
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    new Notification(title, { body, tag, icon: payload.icon });
  } catch {
    /* ignore */
  }
}

/**
 * Schedule a single notification at `when`. Uses TimestampTrigger if available
 * (survives the tab being closed). Otherwise falls back to a foreground timer.
 */
async function scheduleAt({ when, title, body, tag, key }) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const reg = await ensureServiceWorker();
  const delta = when.getTime() - Date.now();
  if (delta <= 0) return;

  if (triggersSupported() && reg) {
    try {
      // eslint-disable-next-line no-undef
      const trigger = new TimestampTrigger(when.getTime());
      await reg.showNotification(title, {
        body,
        tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/favicon-32.png',
        showTrigger: trigger,
        data: { url: '/' },
      });
      return; // OS will fire it.
    } catch {
      /* fall back to setTimeout */
    }
  }

  const handle = setTimeout(() => {
    showNotificationNow({ title, body, tag });
    timers.delete(key);
  }, Math.min(delta, 0x7fffffff));
  timers.set(key, handle);
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export async function getMorningAlarm() {
  const db = getDB();
  if (!db) return DEFAULT_MORNING_ALARM;
  const row = await db.settings.get(MORNING_ALARM_KEY);
  return row?.value || DEFAULT_MORNING_ALARM;
}

export async function setMorningAlarm(hhmm) {
  const db = getDB();
  if (!db) return;
  await db.settings.put({ key: MORNING_ALARM_KEY, value: hhmm });
  await rescheduleAll();
}

export async function getNotificationPrefs() {
  const db = getDB();
  if (!db) return { ...DEFAULT_PREFS };
  const row = await db.settings.get(PREFS_KEY);
  const stored = row?.value || {};
  return {
    ...DEFAULT_PREFS,
    ...stored,
    quoteTimes: Array.isArray(stored.quoteTimes) && stored.quoteTimes.length
      ? stored.quoteTimes
      : DEFAULT_QUOTE_TIMES,
  };
}

export async function setNotificationPrefs(patch) {
  const db = getDB();
  if (!db) return;
  const current = await getNotificationPrefs();
  const next = { ...current, ...patch };
  await db.settings.put({ key: PREFS_KEY, value: next });
  await rescheduleAll();
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                  */
/* -------------------------------------------------------------------------- */

function clearAllTimers() {
  for (const id of timers.values()) clearTimeout(id);
  timers.clear();
}

async function clearTriggeredNotifications() {
  if (!triggersSupported()) return;
  const reg = await ensureServiceWorker();
  if (!reg) return;
  try {
    const list = await reg.getNotifications({ includeTriggered: true });
    for (const n of list) n.close();
  } catch {
    /* ignore */
  }
}

function timeStringToToday(hhmm, baseDate = new Date()) {
  const [h, m] = String(hhmm || '').split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
}

async function getCompletionsForToday(dateKey) {
  const db = getDB();
  if (!db) return new Set();
  const rows = await db.completions.where('date').equals(dateKey).toArray();
  return new Set(rows.map((r) => r.taskId));
}

export async function rescheduleAll() {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') {
    clearAllTimers();
    return;
  }

  clearAllTimers();
  await clearTriggeredNotifications();

  const db = getDB();
  if (!db) return;

  const prefs = await getNotificationPrefs();
  const now = new Date();
  const dateKey = todayKey(now);
  const allTasks = await db.tasks.toArray();
  const todays = allTasks.filter((t) => isTaskOnDate(t, now));
  const doneSet = await getCompletionsForToday(dateKey);

  // 1. Task reminders
  if (prefs.taskReminders) {
    for (const task of todays) {
      if (doneSet.has(task.id)) continue;
      const at = timeStringToToday(task.time);
      if (!at) continue;
      if (at.getTime() <= now.getTime()) continue;
      const key = completionId(dateKey, task.id);
      const body = await pickQuoteAsync(task.id + at.getTime()).catch(() =>
        pickQuote(task.id + at.getTime())
      );
      await scheduleAt({
        when: at,
        title: task.title,
        body,
        tag: `task-${key}`,
        key: `task::${key}`,
      });
    }
  }

  // 2. Morning alarm
  if (prefs.morningAlarm) {
    const morningTime = await getMorningAlarm();
    const morningAt = timeStringToToday(morningTime);
    if (morningAt && morningAt.getTime() > now.getTime()) {
      const first = todays.slice().sort((a, b) => (a.time < b.time ? -1 : 1))[0];
      const body = first
        ? `First up: ${first.time} — ${first.title}.`
        : 'Open TauntTable and plan your day.';
      await scheduleAt({
        when: morningAt,
        title: 'Good morning. Plan your day.',
        body,
        tag: `morning-${dateKey}`,
        key: `morning::${dateKey}`,
      });
    }
  }

  // 3. Daily quote nudges (defaults to 3/day, user can edit times in prefs)
  if (prefs.dailyQuotes) {
    const [customs, favs] = await Promise.all([
      getCustomQuotes().catch(() => []),
      getFavoriteQuotes().catch(() => []),
    ]);
    // Build a pool that strongly weights favourites, falls back to customs,
    // then to the built-ins so the user always sees lines they actually like.
    const base = customs.length ? [...QUOTES, ...customs] : QUOTES;
    const pool = favs.length ? [...favs, ...favs, ...favs, ...base] : base;
    const times = Array.isArray(prefs.quoteTimes) && prefs.quoteTimes.length
      ? prefs.quoteTimes
      : DEFAULT_QUOTE_TIMES;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const at = timeStringToToday(t);
      if (!at || at.getTime() <= now.getTime()) continue;
      const seed = at.getTime() + i * 991;
      const body = pool[Math.abs(seed) % pool.length];
      await scheduleAt({
        when: at,
        title: favs.length ? 'A line for you' : 'Quote for you',
        body,
        tag: `quote-${dateKey}-${i}`,
        key: `quote::${dateKey}::${i}`,
      });
    }
  }
}

/** Fire a one-off notification immediately so the user can verify the wiring. */
export async function sendTestNotification() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'granted') {
    const next = await requestNotificationPermission();
    if (next !== 'granted') return next;
  }
  const body = await pickQuoteAsync(Date.now()).catch(() => pickQuote(Date.now()));
  await showNotificationNow({
    title: 'TauntTable test',
    body,
    tag: `test-${Date.now()}`,
  });
  return 'granted';
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

let bootstrapped = false;
let midnightTimer = null;

export async function bootstrapNotifications() {
  if (typeof window === 'undefined') return;
  if (bootstrapped) return;
  bootstrapped = true;

  await ensureServiceWorker();

  // Re-run the schedule whenever the app comes back to the foreground or
  // regains focus / network. Each event is cheap because timers are cleared
  // and rebuilt from the current Dexie state.
  const reschedule = () => rescheduleAll().catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reschedule();
  });
  window.addEventListener('focus', reschedule);
  window.addEventListener('online', reschedule);
  window.addEventListener('pageshow', reschedule);

  // At midnight, rebuild for the new day.
  function armMidnight() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0);
    midnightTimer = setTimeout(async () => {
      await rescheduleAll();
      armMidnight();
    }, next.getTime() - now.getTime());
  }
  armMidnight();

  await rescheduleAll();
}

// Test entry-point for hot-reload — keep midnightTimer reference alive.
export function _midnightTimerHandle() {
  return midnightTimer;
}
