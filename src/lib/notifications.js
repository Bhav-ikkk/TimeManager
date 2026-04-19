/**
 * src/lib/notifications.js
 * Reminder scheduler for TauntTable.
 *
 * How it works
 * ------------
 * We keep scheduling lightweight and 100% client-side — no servers, no Push API,
 * no paid services. On every app load (and on every task edit) we:
 *
 *   1. Make sure the service worker is registered (so notifications can fire
 *      even if the tab is briefly backgrounded).
 *   2. Read today's tasks from Dexie.
 *   3. For each task whose reminder time is still in the future today and
 *      hasn't been completed, queue a setTimeout that asks the SW to show
 *      a notification.
 *   4. Also queue the user's "morning alarm" — a daily wake-up nudge that
 *      shows the day's first task.
 *
 * Re-scheduling is cheap and idempotent. We track timer IDs in a module-level
 * Map keyed by `${dateKey}::${taskId}` so duplicates can't pile up.
 */
import { getDB, isTaskOnDate, todayKey, completionId } from './db';
import { pickQuote } from './quotes';

const SW_PATH = '/sw.js';
const MORNING_ALARM_KEY = 'morning-alarm-time'; // "HH:mm"
const DEFAULT_MORNING_ALARM = '07:00';

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
    const result = await Notification.requestPermission();
    return result;
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

/* -------------------------------------------------------------------------- */
/* Showing a notification                                                      */
/* -------------------------------------------------------------------------- */

async function showNotification({ title, body, tag }) {
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
  // Prefer SW (works even when tab is briefly backgrounded).
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
  // Last-resort foreground notification.
  try {
    new Notification(title, { body, tag, icon: payload.icon });
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                  */
/* -------------------------------------------------------------------------- */

function clearAllTimers() {
  for (const id of timers.values()) clearTimeout(id);
  timers.clear();
}

function timeStringToToday(hhmm) {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
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
  clearAllTimers();
  if (Notification.permission !== 'granted') return;

  const db = getDB();
  if (!db) return;

  const now = new Date();
  const dateKey = todayKey(now);
  const allTasks = await db.tasks.toArray();
  const todays = allTasks.filter((t) => isTaskOnDate(t, now));
  const doneSet = await getCompletionsForToday(dateKey);

  for (const task of todays) {
    if (doneSet.has(task.id)) continue;
    const at = timeStringToToday(task.time);
    if (!at) continue;
    const delta = at.getTime() - now.getTime();
    if (delta <= 0) continue; // already passed

    const key = completionId(dateKey, task.id);
    const handle = setTimeout(() => {
      showNotification({
        title: task.title,
        body: pickQuote(task.id + at.getTime()),
        tag: key,
      });
      timers.delete(key);
    }, Math.min(delta, 0x7fffffff)); // setTimeout max
    timers.set(key, handle);
  }

  // Morning alarm
  const morningTime = (await db.settings.get(MORNING_ALARM_KEY))?.value || DEFAULT_MORNING_ALARM;
  const morningAt = timeStringToToday(morningTime);
  if (morningAt && morningAt.getTime() > now.getTime()) {
    const key = `morning::${dateKey}`;
    const handle = setTimeout(() => {
      const first = todays.slice().sort((a, b) => (a.time < b.time ? -1 : 1))[0];
      const body = first
        ? `First up: ${first.time} — ${first.title}.`
        : 'Open TauntTable and plan your day.';
      showNotification({
        title: 'Good morning. Plan your day.',
        body,
        tag: key,
      });
      timers.delete(key);
    }, morningAt.getTime() - now.getTime());
    timers.set(key, handle);
  }
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

  // Re-run the schedule when the tab becomes visible again (e.g. PWA reopen).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      rescheduleAll().catch(() => {});
    }
  });

  // At midnight, redo the schedule for the new day.
  function armMidnight() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 5, 0); // 5s after midnight
    midnightTimer = setTimeout(async () => {
      await rescheduleAll();
      armMidnight();
    }, next.getTime() - now.getTime());
  }
  armMidnight();

  await rescheduleAll();
}

/* -------------------------------------------------------------------------- */
/* Settings helpers                                                            */
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
