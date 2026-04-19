'use client';

/**
 * src/hooks/useToday.js
 * Live-query the day's scheduled tasks (recurring + one-offs) and their completion
 * state, sorted by time.
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB, isTaskOnDate, todayKey, completionId } from '@/lib/db';

export function useToday(date = new Date()) {
  const dateKey = todayKey(date);
  const dow = date.getDay();

  const tasks = useLiveQuery(async () => {
    const db = getDB();
    if (!db) return [];
    const all = await db.tasks.toArray();
    return all.filter((t) => isTaskOnDate(t, date));
  }, [dateKey, dow]);

  const completions = useLiveQuery(async () => {
    const db = getDB();
    if (!db) return [];
    return db.completions.where('date').equals(dateKey).toArray();
  }, [dateKey]);

  return useMemo(() => {
    const list = (tasks || []).slice().sort((a, b) => (a.time < b.time ? -1 : 1));
    const doneSet = new Set((completions || []).map((c) => c.taskId));
    return {
      loading: tasks === undefined || completions === undefined,
      tasks: list,
      isDone: (taskId) => doneSet.has(taskId),
      completionId: (taskId) => completionId(dateKey, taskId),
      dateKey,
    };
  }, [tasks, completions, dateKey]);
}
