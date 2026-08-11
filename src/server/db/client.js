/**
 * src/server/db/client.js
 * Lazy Drizzle client over Neon's HTTP driver. Server-side only.
 *
 * Lazy so that importing route modules never requires DATABASE_URL — the
 * app must build and run (local-only mode) without any backend configured.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getServerDB() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
    }
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}
