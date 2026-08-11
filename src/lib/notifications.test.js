/**
 * Tests for the reminder scheduler in src/lib/notifications.js.
 *
 * The scheduler's observable output is the Dexie `pending` store (what the
 * service worker reads to fire notifications while the page is closed), so
 * assertions inspect that store rather than mocking timers.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { getDB, addTask, setCompletion, todayKey } from './db';
import { rescheduleAll, setNotificationPrefs } from './notifications';

class FakeNotification {
  static permission = 'granted';
  static async requestPermission() {
    return FakeNotification.permission;
  }
}

const fakeRegistration = {
  showNotification: async () => {},
  getNotifications: async () => [],
};

beforeAll(() => {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: FakeNotification,
  });
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: async () => fakeRegistration,
      ready: Promise.resolve(fakeRegistration),
      controller: null,
    },
  });
});

async function clearAllTables() {
  const db = getDB();
  for (const table of db.tables) await table.clear();
}

async function pendingByPrefix(prefix) {
  const all = await getDB().pending.toArray();
  return all.filter((e) => e.id.startsWith(prefix)).sort((a, b) => a.when - b.when);
}

function setNow(date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

beforeEach(async () => {
  FakeNotification.permission = 'granted';
  await clearAllTables();
  // Task reminders only, so counts in each test are easy to reason about.
  await getDB().settings.put({
    key: 'notification-prefs',
    value: { taskReminders: true, morningAlarm: false, dailyQuotes: false },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  // Clears the module's in-page timers so no huge real setTimeouts leak.
  FakeNotification.permission = 'denied';
  await rescheduleAll();
});

describe('rescheduleAll', () => {
  it('schedules a recurring task for the next 7 days at the right wall-clock time across DST', async () => {
    // Fri Mar 6 2026, noon — US DST starts Sun Mar 8 (America/New_York).
    setNow(new Date(2026, 2, 6, 12, 0));
    await addTask({ title: 'Evening review', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6] });

    await rescheduleAll();

    const entries = await pendingByPrefix('task::');
    expect(entries).toHaveLength(7);
    for (const entry of entries) {
      const at = new Date(entry.when);
      // If scheduling added fixed 24h offsets instead of using calendar
      // days, entries after Mar 8 would land on 17:00 or 19:00.
      expect(at.getHours()).toBe(18);
      expect(at.getMinutes()).toBe(0);
      expect(entry.when).toBeGreaterThan(Date.now());
    }
    const keys = entries.map((e) => e.id.split('::')[1]);
    expect(keys[0]).toBe('2026-03-06');
    expect(keys[2]).toBe('2026-03-08'); // the 23-hour day
    expect(keys[6]).toBe('2026-03-12');
  });

  it('skips today when the task time has already passed', async () => {
    setNow(new Date(2026, 2, 6, 12, 0));
    await addTask({ title: 'Morning pages', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] });

    await rescheduleAll();

    const entries = await pendingByPrefix('task::');
    expect(entries).toHaveLength(6);
    expect(entries[0].id).toContain('2026-03-07');
  });

  it('skips tasks already completed today', async () => {
    setNow(new Date(2026, 2, 6, 12, 0));
    const taskId = await addTask({ title: 'Workout', time: '18:00', days: [0, 1, 2, 3, 4, 5, 6] });
    await setCompletion(taskId, todayKey(), true);

    await rescheduleAll();

    const entries = await pendingByPrefix('task::');
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => !e.id.includes('2026-03-06'))).toBe(true);
  });

  it('schedules one-off tasks exactly once', async () => {
    setNow(new Date(2026, 2, 6, 12, 0));
    await addTask({ title: 'Dentist', time: '15:00', days: [], dateOneOff: '2026-03-09' });

    await rescheduleAll();

    const entries = await pendingByPrefix('task::');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toContain('2026-03-09');
    expect(new Date(entries[0].when).getHours()).toBe(15);
  });

  it('is idempotent — rescheduling twice does not duplicate entries', async () => {
    setNow(new Date(2026, 2, 6, 12, 0));
    await addTask({ title: 'Read', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] });

    await rescheduleAll();
    await rescheduleAll();

    const entries = await pendingByPrefix('task::');
    expect(entries).toHaveLength(7);
  });

  it('spans month boundaries with correct date keys', async () => {
    setNow(new Date(2026, 0, 29, 8, 0)); // Thu Jan 29 2026
    await addTask({ title: 'Stretch', time: '20:00', days: [0, 1, 2, 3, 4, 5, 6] });

    await rescheduleAll();

    const keys = (await pendingByPrefix('task::')).map((e) => e.id.split('::')[1]);
    expect(keys).toEqual([
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
    ]);
  });

  it('adds morning alarm and quote entries when those prefs are on', async () => {
    setNow(new Date(2026, 2, 6, 6, 0)); // 06:00, before the 07:00 default alarm
    await setNotificationPrefs({ morningAlarm: true, dailyQuotes: true });

    const morning = await pendingByPrefix('morning::');
    expect(morning).toHaveLength(7);
    for (const entry of morning) expect(new Date(entry.when).getHours()).toBe(7);

    // Default quote times: 08:30, 13:30, 20:30 — all still ahead today.
    const quotes = await pendingByPrefix('quote::');
    expect(quotes).toHaveLength(21);
  });

  it('writes nothing without notification permission', async () => {
    setNow(new Date(2026, 2, 6, 12, 0));
    await addTask({ title: 'Journal', time: '19:00', days: [0, 1, 2, 3, 4, 5, 6] });
    FakeNotification.permission = 'denied';

    await rescheduleAll();

    expect(await getDB().pending.toArray()).toHaveLength(0);
  });
});
