// @vitest-environment node
/**
 * Applies the real generated migration (drizzle/*.sql) to an in-process
 * Postgres (PGlite) and probes the constraints the friends feature's
 * security model depends on. No mocks — this is the actual SQL that will
 * run against Neon.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

let pg;

async function insertUser(handle) {
  const res = await pg.query(
    `insert into users (github_id, handle) values ($1, $2) returning id`,
    [`gh-${handle}-${Math.random()}`, handle]
  );
  return res.rows[0].id;
}

beforeAll(async () => {
  pg = new PGlite(); // in-memory
  const dir = path.resolve(__dirname, '../../../drizzle');
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  expect(migrations.length).toBeGreaterThan(0);
  for (const file of migrations) {
    const sqlText = readFileSync(path.join(dir, file), 'utf8');
    for (const statement of sqlText.split('--> statement-breakpoint')) {
      if (statement.trim()) await pg.exec(statement);
    }
  }
});

describe('users', () => {
  it('rejects duplicate handles', async () => {
    await insertUser('dupe-handle');
    await expect(
      pg.query(`insert into users (github_id, handle) values ('gh-other', 'dupe-handle')`)
    ).rejects.toThrow(/unique/i);
  });

  it('defaults timezone to UTC', async () => {
    const id = await insertUser('tz-default');
    const res = await pg.query(`select timezone from users where id = $1`, [id]);
    expect(res.rows[0].timezone).toBe('UTC');
  });
});

describe('friendships', () => {
  it('rejects a reversed duplicate of an existing pair', async () => {
    const a = await insertUser('pair-a');
    const b = await insertUser('pair-b');
    await pg.query(
      `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
      [a, b]
    );
    await expect(
      pg.query(
        `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'pending')`,
        [b, a] // reversed direction must still collide
      )
    ).rejects.toThrow(/unique/i);
  });

  it('rejects self-friendship', async () => {
    const a = await insertUser('selfie');
    await expect(
      pg.query(
        `insert into friendships (requester_id, addressee_id, status) values ($1, $1, 'pending')`,
        [a]
      )
    ).rejects.toThrow(/check/i);
  });

  it('rejects unknown statuses', async () => {
    const a = await insertUser('status-a');
    const b = await insertUser('status-b');
    await expect(
      pg.query(
        `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'frenemy')`,
        [a, b]
      )
    ).rejects.toThrow(/check/i);
  });
});

describe('watched tasks', () => {
  it('rejects malformed HH:mm times', async () => {
    const owner = await insertUser('time-owner');
    await expect(
      pg.query(
        `insert into watched_tasks (owner_id, local_task_ref, title, time) values ($1, '1', 'Run', '25:99')`,
        [owner]
      )
    ).rejects.toThrow(/check/i);
  });

  it('cascades watchers and completions when a watched task is deleted', async () => {
    const owner = await insertUser('cascade-owner');
    const watcher = await insertUser('cascade-watcher');
    const task = await pg.query(
      `insert into watched_tasks (owner_id, local_task_ref, title, time, days)
       values ($1, '42', 'Meditate', '06:30', '{1,3,5}') returning id`,
      [owner]
    );
    const taskId = task.rows[0].id;
    await pg.query(`insert into watchers (watched_task_id, watcher_id) values ($1, $2)`, [taskId, watcher]);
    await pg.query(`insert into watched_completions (watched_task_id, date) values ($1, '2026-08-11')`, [taskId]);

    await pg.query(`delete from watched_tasks where id = $1`, [taskId]);

    const w = await pg.query(`select count(*)::int as n from watchers where watched_task_id = $1`, [taskId]);
    const c = await pg.query(`select count(*)::int as n from watched_completions where watched_task_id = $1`, [taskId]);
    expect(w.rows[0].n).toBe(0);
    expect(c.rows[0].n).toBe(0);
  });

  it('cascades everything when a user deletes their account', async () => {
    const owner = await insertUser('gdpr-owner');
    const task = await pg.query(
      `insert into watched_tasks (owner_id, local_task_ref, title, time) values ($1, '7', 'Read', '21:00') returning id`,
      [owner]
    );
    await pg.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/x', 'k', 'a')`,
      [owner]
    );

    await pg.query(`delete from users where id = $1`, [owner]);

    const t = await pg.query(`select count(*)::int as n from watched_tasks where id = $1`, [task.rows[0].id]);
    const p = await pg.query(`select count(*)::int as n from push_subscriptions where user_id = $1`, [owner]);
    expect(t.rows[0].n).toBe(0);
    expect(p.rows[0].n).toBe(0);
  });
});

describe('push subscriptions', () => {
  it('deduplicates the same endpoint per user', async () => {
    const u = await insertUser('push-user');
    await pg.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/e1', 'k', 'a')`,
      [u]
    );
    await expect(
      pg.query(
        `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/e1', 'k2', 'a2')`,
        [u]
      )
    ).rejects.toThrow(/unique/i);
  });
});
