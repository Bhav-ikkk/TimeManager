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
