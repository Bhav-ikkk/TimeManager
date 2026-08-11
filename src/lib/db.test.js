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
