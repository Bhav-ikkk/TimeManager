/**
 * src/lib/backup.js
 * Full local-data export/import.
 *
 * Everything the user owns lives in Dexie (IndexedDB), which means clearing
 * site data or losing the device loses everything. This module dumps every
 * table to a single JSON file and can restore from one.
 *
 * The `pending` table is excluded: it is a transient notification queue that
 * rescheduleAll() rebuilds from tasks + settings on every app open.
 */
import { getDB } from './db';

export const BACKUP_FORMAT = 1;

const TRANSIENT_TABLES = new Set(['pending']);

/** Serialise every persistent Dexie table into a plain object. */
export async function exportAllData() {
  const db = getDB();
  if (!db) throw new Error('Storage is unavailable in this context.');
  const tables = {};
  for (const table of db.tables) {
    if (TRANSIENT_TABLES.has(table.name)) continue;
    tables[table.name] = await table.toArray();
  }
  return {
    app: 'taunttable',
    format: BACKUP_FORMAT,
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Trigger a browser download of the current data as a JSON file. */
export async function downloadBackup() {
  const data = await exportAllData();
  const date = data.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `taunttable-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return data;
}

/** Basic shape check before we wipe anything. Returns row counts per table. */
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid backup file.');
  if (parsed.app !== 'taunttable') throw new Error('This file is not a TauntTable backup.');
  if (typeof parsed.format !== 'number' || parsed.format > BACKUP_FORMAT) {
    throw new Error('This backup was made by a newer version of TauntTable. Update the app first.');
  }
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Backup file has no data tables.');
  }
  const counts = {};
  for (const [name, rows] of Object.entries(parsed.tables)) {
    if (!Array.isArray(rows)) throw new Error(`Table "${name}" in the backup is corrupted.`);
    counts[name] = rows.length;
  }
  return counts;
}

/**
 * Replace all local data with the backup's contents. Runs in a single
 * transaction so a failed import can't leave the database half-restored.
 * Tables present locally but missing from the backup are left untouched.
 */
export async function importAllData(parsed) {
  const db = getDB();
  if (!db) throw new Error('Storage is unavailable in this context.');
  validateBackup(parsed);

  const known = db.tables.filter(
    (t) => !TRANSIENT_TABLES.has(t.name) && Array.isArray(parsed.tables[t.name])
  );
  if (!known.length) throw new Error('Backup contains no importable data.');

  await db.transaction('rw', known, async () => {
    for (const table of known) {
      await table.clear();
      const rows = parsed.tables[table.name];
      if (rows.length) await table.bulkPut(rows);
    }
  });

  return known.map((t) => t.name);
}
