/**
 * Tests for the reminder scheduler in src/lib/notifications.js.
 *
 * The scheduler's observable output is the Dexie `pending` store (what the
 * service worker reads to fire notifications while the page is closed), so
 * assertions inspect that store rather than mocking timers.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { getDB, addTask } from './db';
import { rescheduleAll } from './notifications';

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
});
