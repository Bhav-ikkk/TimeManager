/**
 * Tests for the date/recurrence core in src/lib/db.js.
 *
 * These run under a DST-observing timezone (see vitest.config.mjs) so any
 * math that assumes a constant UTC offset breaks loudly here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDB,
  todayKey,
  dateFromKey,
  completionId,
  isTaskOnDate,
  addTask,
  setCompletion,
  getRangeStats,
} from './db';

async function clearAllTables() {
  const db = getDB();
  for (const table of db.tables) await table.clear();
}

function setNow(date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

beforeEach(async () => {
  await clearAllTables();
});

afterEach(() => {
  vi.useRealTimers();
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

describe('getRangeStats', () => {
  it('computes scheduled/completed/missed per day across a month boundary', async () => {
    setNow(new Date(2026, 1, 2, 12, 0)); // Feb 2 2026
    const taskId = await addTask({
      title: 'Daily run',
      time: '07:00',
      days: [0, 1, 2, 3, 4, 5, 6],
    });
    // Backdate creation so the whole range is in scope.
    await getDB().tasks.update(taskId, { createdAt: new Date(2026, 0, 25).getTime() });

    await setCompletion(taskId, '2026-01-31', true);

    const stats = await getRangeStats(new Date(2026, 0, 30), new Date(2026, 1, 2));
    expect(stats.map((s) => s.dateKey)).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
    for (const s of stats) expect(s.scheduled).toBe(1);
    expect(stats.find((s) => s.dateKey === '2026-01-31').completed).toBe(1);
    expect(stats.find((s) => s.dateKey === '2026-01-31').missed).toBe(0);
    expect(stats.find((s) => s.dateKey === '2026-01-30').missed).toBe(1);
  });

  it('enumerates exactly one entry per calendar day across the spring-forward DST day', async () => {
    setNow(new Date(2026, 2, 10, 12, 0)); // Mar 10 2026
    const taskId = await addTask({
      title: 'Meditate',
      time: '06:30',
      days: [0, 1, 2, 3, 4, 5, 6],
    });
    await getDB().tasks.update(taskId, { createdAt: new Date(2026, 2, 1).getTime() });

    const stats = await getRangeStats(new Date(2026, 2, 7), new Date(2026, 2, 10));
    expect(stats.map((s) => s.dateKey)).toEqual([
      '2026-03-07',
      '2026-03-08', // 23-hour day in America/New_York
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  it('does not schedule tasks before their creation date', async () => {
    setNow(new Date(2026, 3, 10, 12, 0)); // Apr 10 2026
    await addTask({ title: 'New habit', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] });

    const stats = await getRangeStats(new Date(2026, 3, 8), new Date(2026, 3, 10));
    expect(stats.find((s) => s.dateKey === '2026-04-08').scheduled).toBe(0);
    expect(stats.find((s) => s.dateKey === '2026-04-09').scheduled).toBe(0);
    expect(stats.find((s) => s.dateKey === '2026-04-10').scheduled).toBe(1);
  });

  it('shows one-off tasks only on their date', async () => {
    setNow(new Date(2026, 4, 1, 9, 0)); // May 1 2026
    await addTask({ title: 'Dentist', time: '15:00', days: [], dateOneOff: '2026-05-02' });

    const stats = await getRangeStats(new Date(2026, 4, 1), new Date(2026, 4, 3));
    expect(stats.map((s) => s.scheduled)).toEqual([0, 1, 0]);
  });

  it('returns an empty array for a reversed range', async () => {
    const stats = await getRangeStats(new Date(2026, 5, 10), new Date(2026, 5, 1));
    expect(stats).toEqual([]);
  });
});
