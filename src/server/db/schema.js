/**
 * src/server/db/schema.js
 * Drizzle schema for the opt-in friends feature — the ONLY data that ever
 * leaves the device. Everything else (journal, diet, unwatched tasks)
 * stays in the browser's IndexedDB and has no table here by design; the
 * privacy boundary is enforced by this schema, not just by client code.
 *
 * Sessions are JWT-based (Auth.js), so there are no session/account tables.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: text('github_id').notNull().unique(),
  handle: text('handle').notNull().unique(),
  displayName: text('display_name'),
  // IANA zone name (e.g. "Asia/Kolkata"), captured from the client. The
  // miss-detection cron interprets watched-task times in this zone — a bare
  // "HH:mm" is meaningless in UTC.
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    deviceLabel: text('device_label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('push_subscriptions_user_endpoint_uq').on(t.userId, t.endpoint)]
);

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('friendships_status_check', sql`${t.status} in ('pending', 'accepted', 'blocked')`),
    check('friendships_no_self_check', sql`${t.requesterId} <> ${t.addresseeId}`),
    // One row per pair regardless of direction: A→B and B→A collide here,
    // closing the duplicate/conflicting-row hole a plain
    // unique(requester, addressee) would leave open.
    uniqueIndex('friendships_pair_uq').on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`
    ),
    index('friendships_addressee_idx').on(t.addresseeId),
  ]
);

export const watchedTasks = pgTable(
  'watched_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Opaque id of the owner's local Dexie task; correlation only, never
    // authoritative outside the owner's own client.
    localTaskRef: text('local_task_ref').notNull(),
    title: text('title').notNull(),
    time: text('time').notNull(),
    // Recurrence weekdays (0=Sun..6=Sat). Empty means one-off: dateOneOff
    // must carry the date, mirroring the local Dexie task model.
    days: integer('days').array().notNull().default(sql`'{}'::integer[]`),
    dateOneOff: date('date_one_off'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('watched_tasks_owner_idx').on(t.ownerId),
    check('watched_tasks_time_check', sql`${t.time} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ]
);

export const watchers = pgTable(
  'watchers',
  {
    watchedTaskId: uuid('watched_task_id')
      .notNull()
      .references(() => watchedTasks.id, { onDelete: 'cascade' }),
    watcherId: uuid('watcher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.watchedTaskId, t.watcherId] })]
);

export const watchedCompletions = pgTable(
  'watched_completions',
  {
    watchedTaskId: uuid('watched_task_id')
      .notNull()
      .references(() => watchedTasks.id, { onDelete: 'cascade' }),
    // Calendar date in the owner's timezone.
    date: date('date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.watchedTaskId, t.date] })]
);
