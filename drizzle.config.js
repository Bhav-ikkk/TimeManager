import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.js',
  out: './drizzle',
  dbCredentials: {
    // Only needed for `drizzle-kit migrate/push`; `generate` works offline.
    url: process.env.DATABASE_URL ?? '',
  },
});
