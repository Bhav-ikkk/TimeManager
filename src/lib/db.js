/**
 * src/lib/db.js
 * Local-only IndexedDB store via Dexie.
 *
 * Schema
 * ------
 * tasks
 *   id           auto-incremented primary key
 *   title        string (user-typed task name)
 *   time         "HH:mm" 24h string the reminder fires at
 *   days         number[]: 0=Sun, 1=Mon, ... 6=Sat. If empty, treat as one-off
 *                that only fires on `dateOneOff` (an ISO yyyy-MM-dd date).
 *   dateOneOff   optional yyyy-MM-dd for non-recurring tasks
 *   note         optional short note
 *   createdAt    epoch ms
 *   updatedAt    epoch ms
 *
 * completions
 *   id           "yyyy-MM-dd::<taskId>"  (composite primary key kept simple)
 *   taskId       number
 *   date         yyyy-MM-dd
 *   completedAt  epoch ms
 *
 * journal
 *   date         yyyy-MM-dd (primary key — one entry per day)
 *   text         string
 *   verdict      "praise" | "roast" | null
 *   message      string (the actual praise / roast that was shown)
 *   missedTaskIds number[]
 *   savedAt      epoch ms
 *
 * settings
 *   key          string primary key
 *   value        any
 */
import Dexie from 'dexie';

class TauntDB extends Dexie {
  constructor() {
    super('taunttable');
    this.version(1).stores({
      tasks: '++id, time, createdAt',
      completions: 'id, taskId, date',
      journal: 'date',
      settings: 'key',
    });
  }
}

let _db = null;

/** Lazy singleton — Dexie must only be created in the browser. */
export function getDB() {
  if (typeof window === 'undefined') return null;
  if (!_db) _db = new TauntDB();
  return _db;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function completionId(date, taskId) {
  return `${date}::${taskId}`;
}

/** True when `task` is scheduled to appear on the given JS Date. */
export function isTaskOnDate(task, date) {
  if (Array.isArray(task.days) && task.days.length > 0) {
    return task.days.includes(date.getDay());
  }
  return task.dateOneOff === todayKey(date);
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function addTask(input) {
  const db = getDB();
  if (!db) return null;
  const now = Date.now();
  const id = await db.tasks.add({
    title: String(input.title || '').trim(),
    time: input.time, // "HH:mm"
    days: Array.isArray(input.days) ? [...new Set(input.days)].sort() : [],
    dateOneOff: input.dateOneOff || null,
    note: input.note || '',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTask(id, patch) {
  const db = getDB();
  if (!db) return 0;
  return db.tasks.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteTask(id) {
  const db = getDB();
  if (!db) return;
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.tasks.delete(id);
    await db.completions.where('taskId').equals(id).delete();
  });
}

export async function setCompletion(taskId, date, done) {
  const db = getDB();
  if (!db) return;
  const id = completionId(date, taskId);
  if (done) {
    await db.completions.put({ id, taskId, date, completedAt: Date.now() });
  } else {
    await db.completions.delete(id);
  }
}

export async function getJournal(date) {
  const db = getDB();
  if (!db) return null;
  return db.journal.get(date);
}

export async function saveJournal(entry) {
  const db = getDB();
  if (!db) return;
  await db.journal.put({ ...entry, savedAt: Date.now() });
}

/**
 * Returns every saved journal entry, newest first. Used by the History
 * section on the Journal page so past days can be reopened.
 */
export async function listJournals() {
  const db = getDB();
  if (!db) return [];
  const rows = await db.journal.toArray();
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteJournal(date) {
  const db = getDB();
  if (!db) return;
  await db.journal.delete(date);
}

export async function getSetting(key, fallback = null) {
  const db = getDB();
  if (!db) return fallback;
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = getDB();
  if (!db) return;
  await db.settings.put({ key, value });
}

/* ------------------------------------------------------------------ */
/* Custom quotes (user-added motivational lines)                       */
/* ------------------------------------------------------------------ */

const CUSTOM_QUOTES_KEY = 'custom-quotes';

export async function getCustomQuotes() {
  const list = await getSetting(CUSTOM_QUOTES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function addCustomQuote(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  const list = await getCustomQuotes();
  if (list.includes(trimmed)) return;
  list.push(trimmed);
  await setSetting(CUSTOM_QUOTES_KEY, list);
}

export async function removeCustomQuote(text) {
  const list = await getCustomQuotes();
  const next = list.filter((q) => q !== text);
  await setSetting(CUSTOM_QUOTES_KEY, next);
}
