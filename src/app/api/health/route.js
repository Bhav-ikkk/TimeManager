/**
 * GET /api/health — backend plumbing check for the opt-in friends feature.
 * Reports which pieces are configured without leaking secrets or details.
 * The app itself works fully offline; "unconfigured" here is a valid state.
 */
import { sql } from 'drizzle-orm';
import { getServerDB, isDatabaseConfigured } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: 'unconfigured',
    githubOAuth: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
    authSecret: Boolean(process.env.AUTH_SECRET),
  };

  if (isDatabaseConfigured()) {
    try {
      await getServerDB().execute(sql`select 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }
  }

  const ok = checks.database === 'ok' && checks.githubOAuth && checks.authSecret;
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
