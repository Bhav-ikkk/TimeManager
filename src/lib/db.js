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
 *
 * daySnapshots
 *   date         yyyy-MM-dd (primary key)
 *   tasks        frozen task rows for that date, including completion state
 *   updatedAt    epoch ms
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
    // v2: add a "pending" store the service worker can read directly while
    // the page is closed, so scheduled reminders still fire on mobile.
    this.version(2).stores({
      tasks: '++id, time, createdAt',
      completions: 'id, taskId, date',
      journal: 'date',
      settings: 'key',
      pending: 'id, when, tag',
    });
    // v3: calorie tracker.
    //   foodEntries  one row per food item the user logs in a day
    //   foodReports  one Gemini-generated analysis per period
    //                id is the period key: 'day-2026-04-28', 'week-2026-W17',
    //                'month-2026-04'.
    this.version(3).stores({
      tasks: '++id, time, createdAt',
      completions: 'id, taskId, date',
      journal: 'date',
      settings: 'key',
      pending: 'id, when, tag',
      foodEntries: '++id, date, at',
      foodReports: 'id, kind, startDate, endDate, savedAt',
    });
    // v4: day snapshots preserve historical summaries even after tasks are
    // edited or deleted later.
    this.version(4).stores({
      tasks: '++id, time, createdAt',
      completions: 'id, taskId, date',
      journal: 'date',
      settings: 'key',
      pending: 'id, when, tag',
      foodEntries: '++id, date, at',
      foodReports: 'id, kind, startDate, endDate, savedAt',
      daySnapshots: 'date, updatedAt',
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

export function dateFromKey(dateKey) {
  const parts = String(dateKey || '').split('-').map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return new Date(dateKey);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function completionId(date, taskId) {
  return `${date}::${taskId}`;
}

/** True when `task` is scheduled to appear on the given JS Date. */
export function isTaskOnDate(task, date) {
  // A task can't be "missed" before it existed — don't backfill it onto past
  // dates that predate its creation.
  if (typeof task.createdAt === 'number') {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    if (task.createdAt > endOfDay.getTime()) return false;
  }
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
  await captureDaySnapshot(todayKey()).catch(() => {});
  return id;
}

export async function updateTask(id, patch) {
  const db = getDB();
  if (!db) return 0;
  const existing = await db.tasks.get(id);
  await captureTaskHistory(existing, { includeToday: false }).catch(() => {});
  const result = await db.tasks.update(id, { ...patch, updatedAt: Date.now() });
  await captureDaySnapshot(todayKey()).catch(() => {});
  return result;
}

export async function deleteTask(id) {
  const db = getDB();
  if (!db) return;
  const existing = await db.tasks.get(id);
  await captureTaskHistory(existing, { includeToday: true }).catch(() => {});
  await db.tasks.delete(id);
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
  await captureDaySnapshot(date).catch(() => {});
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
  await captureDaySnapshot(entry.date || todayKey()).catch(() => {});
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
const FAVORITE_QUOTES_KEY = 'favorite-quotes';

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
  // Also drop from favorites if it was there.
  const favs = await getFavoriteQuotes();
  if (favs.includes(text)) {
    await setSetting(FAVORITE_QUOTES_KEY, favs.filter((q) => q !== text));
  }
}

export async function getFavoriteQuotes() {
  const list = await getSetting(FAVORITE_QUOTES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function isFavoriteQuote(text) {
  const favs = await getFavoriteQuotes();
  return favs.includes(text);
}

export async function toggleFavoriteQuote(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  const favs = await getFavoriteQuotes();
  const exists = favs.includes(trimmed);
  const next = exists ? favs.filter((q) => q !== trimmed) : [...favs, trimmed];
  await setSetting(FAVORITE_QUOTES_KEY, next);
  return !exists;
}

/* ------------------------------------------------------------------ */
/* Pending notifications (read by the service worker while page is closed) */
/* ------------------------------------------------------------------ */

export async function putPendingNotification(entry) {
  const db = getDB();
  if (!db) return;
  await db.pending.put(entry);
}

export async function deletePendingNotification(id) {
  const db = getDB();
  if (!db) return;
  await db.pending.delete(id);
}

export async function clearPendingNotificationsByPrefix(prefix) {
  const db = getDB();
  if (!db) return;
  const all = await db.pending.toArray();
  const ids = all.filter((e) => typeof e.id === 'string' && e.id.startsWith(prefix)).map((e) => e.id);
  if (ids.length) await db.pending.bulkDelete(ids);
}

export async function clearAllPendingNotifications() {
  const db = getDB();
  if (!db) return;
  await db.pending.clear();
}

/* ------------------------------------------------------------------ */
/* Calorie tracker                                                     */
/* ------------------------------------------------------------------ */

export async function addFoodEntry({
  date,
  at,
  text,
  kcalEst = null,
  grams = null,
  fdcId = null,
  brand = null,
  nutrition = null, // { kcal, protein_g, fat_g, carbs_g, fiber_g, sugar_g, sodium_mg }
  source = 'text',  // 'text' | 'usda' | 'manual'
}) {
  const db = getDB();
  if (!db) return null;
  const cleanText = String(text || '').trim().slice(0, 240);
  if (!cleanText) return null;
  const id = await db.foodEntries.add({
    date: date || todayKey(),
    at: typeof at === 'number' ? at : Date.now(),
    text: cleanText,
    kcalEst,
    grams,
    fdcId,
    brand,
    nutrition,
    source,
  });
  return id;
}

export async function updateFoodEntry(id, patch) {
  const db = getDB();
  if (!db) return 0;
  const safe = {};
  if (typeof patch.text === 'string') safe.text = patch.text.trim().slice(0, 240);
  if (typeof patch.at === 'number') safe.at = patch.at;
  if (typeof patch.date === 'string') safe.date = patch.date;
  if (patch.kcalEst === null || typeof patch.kcalEst === 'number') safe.kcalEst = patch.kcalEst;
  if (patch.grams === null || typeof patch.grams === 'number') safe.grams = patch.grams;
  if (patch.fdcId === null || typeof patch.fdcId === 'number') safe.fdcId = patch.fdcId;
  if (patch.brand === null || typeof patch.brand === 'string') safe.brand = patch.brand;
  if (patch.nutrition === null || (patch.nutrition && typeof patch.nutrition === 'object')) safe.nutrition = patch.nutrition;
  if (typeof patch.source === 'string') safe.source = patch.source;
  return db.foodEntries.update(id, safe);
}

export async function deleteFoodEntry(id) {
  const db = getDB();
  if (!db) return;
  await db.foodEntries.delete(id);
}

export async function listFoodEntriesForDate(date) {
  const db = getDB();
  if (!db) return [];
  const rows = await db.foodEntries.where('date').equals(date).toArray();
  return rows.sort((a, b) => (a.at || 0) - (b.at || 0));
}

export async function listFoodEntriesBetween(startDate, endDate) {
  const db = getDB();
  if (!db) return [];
  const rows = await db.foodEntries
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
  return rows.sort((a, b) => {
    if (a.date === b.date) return (a.at || 0) - (b.at || 0);
    return a.date < b.date ? -1 : 1;
  });
}

export async function saveFoodReport(report) {
  const db = getDB();
  if (!db) return;
  await db.foodReports.put({ ...report, savedAt: Date.now() });
}

export async function getFoodReport(id) {
  const db = getDB();
  if (!db) return null;
  return db.foodReports.get(id);
}

export async function listFoodReports(kind) {
  const db = getDB();
  if (!db) return [];
  const rows = kind
    ? await db.foodReports.where('kind').equals(kind).toArray()
    : await db.foodReports.toArray();
  return rows.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export async function deleteFoodReport(id) {
  const db = getDB();
  if (!db) return;
  await db.foodReports.delete(id);
}

/* ------------------------------------------------------------------ */
/* Day snapshots                                                       */
/* ------------------------------------------------------------------ */

function taskSnapshot(task, completed) {
  return {
    id: task.id,
    title: String(task.title || 'Untitled task').slice(0, 80),
    time: /^\d{2}:\d{2}$/.test(String(task.time || '')) ? task.time : '00:00',
    note: String(task.note || '').slice(0, 200),
    completed: Boolean(completed),
  };
}

function fallbackTaskSnapshot(taskId, completed) {
  return {
    id: taskId,
    title: `Deleted task #${taskId}`,
    time: '00:00',
    note: '',
    completed: Boolean(completed),
    archived: true,
  };
}

function snapshotRowFromStat(stat) {
  return {
    date: stat.dateKey,
    tasks: stat.tasks.map((task) => ({ ...task })),
    updatedAt: Date.now(),
  };
}

function statFromState(dateObject, allTasks, doneSet, existingSnapshot = null) {
  const dateKey = todayKey(dateObject);
  const tasksById = new Map();
  const taskById = new Map(allTasks.map((task) => [task.id, task]));

  if (Array.isArray(existingSnapshot?.tasks)) {
    for (const snapshotTask of existingSnapshot.tasks) {
      if (snapshotTask?.id == null) continue;
      tasksById.set(snapshotTask.id, {
        ...snapshotTask,
        completed: doneSet.has(snapshotTask.id),
      });
    }
  }

  for (const task of allTasks) {
    if (isTaskOnDate(task, dateObject)) {
      tasksById.set(task.id, taskSnapshot(task, doneSet.has(task.id)));
    }
  }

  for (const taskId of doneSet) {
    if (tasksById.has(taskId)) continue;
    const task = taskById.get(taskId);
    tasksById.set(taskId, task ? taskSnapshot(task, true) : fallbackTaskSnapshot(taskId, true));
  }

  const tasks = [...tasksById.values()].sort((leftTask, rightTask) => {
    if (leftTask.time === rightTask.time) return String(leftTask.title).localeCompare(String(rightTask.title));
    return leftTask.time < rightTask.time ? -1 : 1;
  });
  const completed = tasks.filter((task) => task.completed).length;

  return {
    dateKey,
    date: dateObject,
    scheduled: tasks.length,
    completed,
    missed: tasks.length - completed,
    tasks,
  };
}

async function getDoneSetForDate(db, dateKey) {
  const completions = await db.completions.where('date').equals(dateKey).toArray();
  return new Set(completions.map((completion) => completion.taskId));
}

export async function captureDaySnapshot(dateInput = todayKey()) {
  const db = getDB();
  if (!db) return null;
  const dateKey = typeof dateInput === 'string' ? dateInput : todayKey(dateInput);
  const dateObject = typeof dateInput === 'string' ? dateFromKey(dateInput) : new Date(dateInput);
  const [allTasks, doneSet, existingSnapshot] = await Promise.all([
    db.tasks.toArray(),
    getDoneSetForDate(db, dateKey),
    db.daySnapshots.get(dateKey),
  ]);
  const stat = statFromState(dateObject, allTasks, doneSet, existingSnapshot);
  await db.daySnapshots.put(snapshotRowFromStat(stat));
  return stat;
}

async function captureTaskHistory(task, { includeToday = false } = {}) {
  if (!task || typeof task.createdAt !== 'number') return;
  const startDate = new Date(task.createdAt);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  if (!includeToday) endDate.setDate(endDate.getDate() - 1);
  if (endDate < startDate) return;

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const day = new Date(cursor);
    if (isTaskOnDate(task, day)) {
      await captureDaySnapshot(todayKey(day));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Range stats — used by the Summary page                              */
/* ------------------------------------------------------------------ */

/**
 * For every day in [startDate, endDate] (inclusive), compute scheduled vs
 * completed counts. Returns an array of { dateKey, scheduled, completed,
 * missed, tasks: [{ id, title, time, completed }] } ordered ascending.
 */
export async function getRangeStats(startDate, endDate) {
  const db = getDB();
  if (!db) return [];
  const allTasks = await db.tasks.toArray();
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (end < start) return [];

  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const startKey = todayKey(start);
  const endKey = todayKey(end);

  const [completions, snapshots] = await Promise.all([
    db.completions
      .where('date')
      .between(startKey, endKey, true, true)
      .toArray(),
    db.daySnapshots
      .where('date')
      .between(startKey, endKey, true, true)
      .toArray(),
  ]);
  const doneByDate = new Map();
  for (const completion of completions) {
    if (!doneByDate.has(completion.date)) doneByDate.set(completion.date, new Set());
    doneByDate.get(completion.date).add(completion.taskId);
  }
  const snapshotsByDate = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot]));

  const stats = days.map((dateObject) => {
    const key = todayKey(dateObject);
    return statFromState(
      dateObject,
      allTasks,
      doneByDate.get(key) || new Set(),
      snapshotsByDate.get(key) || null
    );
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const missingSnapshots = stats
    .filter((stat) => stat.scheduled > 0)
    .filter((stat) => !isFutureDate(stat.date, todayStart))
    .filter((stat) => !snapshotsByDate.has(stat.dateKey))
    .map(snapshotRowFromStat);
  if (missingSnapshots.length) await db.daySnapshots.bulkPut(missingSnapshots);

  return stats;
}

function isFutureDate(dateObject, todayStart) {
  const dayStart = new Date(dateObject);
  dayStart.setHours(0, 0, 0, 0);
  return dayStart > todayStart;
}
