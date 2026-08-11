/**
 * src/server/auth.js
 * Auth.js (NextAuth v5) with GitHub OAuth and JWT sessions.
 *
 * JWT strategy on purpose: no session/account tables in Postgres, the
 * encrypted cookie carries { userId, handle }. The only DB write is the
 * users-row upsert on first sign-in.
 *
 * Env vars (see .env.example): AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET.
 */
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { eq } from 'drizzle-orm';
import { getServerDB } from './db/client';
import { users } from './db/schema';

/** Derive a URL-safe base handle from the GitHub login. */
function baseHandle(login) {
  const clean = String(login || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return clean || 'user';
}

/**
 * Find-or-create the users row for a GitHub profile. Handles are unique and
 * shareable (@handle in friend search), so collisions get a numeric suffix.
 */
async function ensureUser(profile) {
  const db = getServerDB();
  const githubId = String(profile.id);

  const existing = await db.query.users.findFirst({ where: eq(users.githubId, githubId) });
  if (existing) return existing;

  const base = baseHandle(profile.login);
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const [created] = await db
        .insert(users)
        .values({
          githubId,
          handle,
          displayName: profile.name || profile.login || null,
        })
        .returning();
      return created;
    } catch (e) {
      // Unique violation on handle → retry with a suffix. A concurrent
      // insert of the same github_id also lands here; re-read and return.
      const again = await db.query.users.findFirst({ where: eq(users.githubId, githubId) });
      if (again) return again;
    }
  }
  throw new Error('Could not allocate a unique handle.');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Runs with account+profile only on the initial sign-in.
      if (account && profile) {
        const user = await ensureUser(profile);
        token.userId = user.id;
        token.handle = user.handle;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.userId = token.userId;
        session.handle = token.handle;
      }
      return session;
    },
  },
});
