/** Round-trip tests for the export/import backup module. */
import { describe, it, expect, beforeEach } from 'vitest';
import { getDB, addTask, setCompletion, saveJournal, todayKey } from './db';
import { exportAllData, importAllData, validateBackup } from './backup';

async function clearAllTables() {
  const db = getDB();
  for (const table of db.tables) await table.clear();
}

beforeEach(async () => {
  await clearAllTables();
});

describe('export / import', () => {
  it('round-trips all user data and preserves task ids', async () => {
    const taskId = await addTask({ title: 'Run', time: '07:00', days: [1, 3, 5] });
    await setCompletion(taskId, todayKey(), true);
    await saveJournal({ date: todayKey(), text: 'good day', verdict: 'praise' });
    await getDB().settings.put({ key: 'some-pref', value: 42 });

    const backup = await exportAllData();
    expect(backup.app).toBe('taunttable');
    expect(backup.tables.tasks).toHaveLength(1);
    expect(backup.tables.pending).toBeUndefined(); // transient queue excluded

    await clearAllTables();
    expect(await getDB().tasks.count()).toBe(0);

    await importAllData(backup);

    const tasks = await getDB().tasks.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(taskId);
    expect(tasks[0].title).toBe('Run');
    expect(await getDB().completions.count()).toBe(1);
    expect((await getDB().journal.get(todayKey())).text).toBe('good day');
    expect((await getDB().settings.get('some-pref')).value).toBe(42);
  });

  it('replaces existing data instead of merging', async () => {
    await addTask({ title: 'Old task', time: '09:00', days: [1] });
    const backup = await exportAllData();

    await clearAllTables();
    await addTask({ title: 'Newer task', time: '10:00', days: [2] });

    await importAllData(backup);

    const tasks = await getDB().tasks.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Old task');
  });

  it('rejects files that are not TauntTable backups', () => {
    expect(() => validateBackup(null)).toThrow();
    expect(() => validateBackup({ app: 'other' })).toThrow();
    expect(() => validateBackup({ app: 'taunttable', format: 999, tables: {} })).toThrow(/newer version/);
    expect(() => validateBackup({ app: 'taunttable', format: 1, tables: { tasks: 'nope' } })).toThrow(/corrupted/);
  });

  it('leaves existing data untouched when the backup has no importable tables', async () => {
    await addTask({ title: 'Keep me', time: '09:00', days: [1] });
    await expect(
      importAllData({ app: 'taunttable', format: 1, tables: { unknown: [] } })
    ).rejects.toThrow(/no importable/);
    expect(await getDB().tasks.count()).toBe(1);
  });
});
