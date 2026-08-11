/**
 * Tests for the date/recurrence core in src/lib/db.js.
 *
 * These run under a DST-observing timezone (see vitest.config.mjs) so any
 * math that assumes a constant UTC offset breaks loudly here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDB,
  todayKey,
  dateFromKey,
  completionId,
  isTaskOnDate,
} from './db';

async function clearAllTables() {
  const db = getDB();
  for (const table of db.tables) await table.clear();
}

beforeEach(async () => {
  await clearAllTables();
});

describe('todayKey / dateFromKey', () => {
  it('round-trips a local calendar date', () => {
    const d = new Date(2026, 0, 31); // Jan 31 2026, local midnight
    const key = todayKey(d);
    expect(key).toBe('2026-01-31');
    const back = dateFromKey(key);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(0);
    expect(back.getDate()).toBe(31);
  });

  it('pads single-digit months and days', () => {
    expect(todayKey(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('builds completion ids as date::taskId', () => {
    expect(completionId('2026-09-05', 12)).toBe('2026-09-05::12');
  });
});

describe('isTaskOnDate', () => {
  const base = { title: 'x', time: '09:00', createdAt: new Date(2026, 0, 1).getTime() };

  it('matches recurring tasks by weekday', () => {
    const task = { ...base, days: [1, 3] }; // Mon, Wed
    expect(isTaskOnDate(task, new Date(2026, 0, 5))).toBe(true); // Mon
    expect(isTaskOnDate(task, new Date(2026, 0, 6))).toBe(false); // Tue
    expect(isTaskOnDate(task, new Date(2026, 0, 7))).toBe(true); // Wed
  });

  it('matches one-off tasks only on their exact date', () => {
    const task = { ...base, days: [], dateOneOff: '2026-02-14' };
    expect(isTaskOnDate(task, new Date(2026, 1, 14))).toBe(true);
    expect(isTaskOnDate(task, new Date(2026, 1, 13))).toBe(false);
    expect(isTaskOnDate(task, new Date(2026, 1, 15))).toBe(false);
  });

  it('never backfills onto dates before the task was created', () => {
    const created = new Date(2026, 5, 15, 14, 30); // Jun 15, 2:30pm
    const task = { ...base, createdAt: created.getTime(), days: [0, 1, 2, 3, 4, 5, 6] };
    expect(isTaskOnDate(task, new Date(2026, 5, 14))).toBe(false); // day before
    expect(isTaskOnDate(task, new Date(2026, 5, 15))).toBe(true); // creation day
    expect(isTaskOnDate(task, new Date(2026, 5, 16))).toBe(true);
  });

  it('handles weekday matching across a DST transition', () => {
    // US DST starts Sun Mar 8 2026 (tests run in America/New_York).
    const task = { ...base, days: [0] }; // Sundays
    expect(isTaskOnDate(task, new Date(2026, 2, 8))).toBe(true);
    expect(isTaskOnDate(task, new Date(2026, 2, 9))).toBe(false);
  });
});
