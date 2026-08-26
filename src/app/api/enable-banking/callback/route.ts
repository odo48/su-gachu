import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeEnableBankingSession } from '@/lib/enable-banking/client';
import { requireEnableBankingCreds } from '@/lib/enable-banking/connection';
import { persistEnableBankingSession } from '@/lib/enable-banking/link';
import { EB_OAUTH_COOKIE, ebOAuthCookieOptions, type EbOAuthCookie } from '@/lib/enable-banking/oauth';
import { syncAllBalances } from '@/lib/enable-banking/sync';

export const runtime = 'nodejs';

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = '/dashboard';
  url.search = '';
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = NextResponse.redirect(url);
  res.cookies.set(EB_OAUTH_COOKIE, '', ebOAuthCookieOptions(0));
  return res;
}

function parseCookie(raw: string | undefined): EbOAuthCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EbOAuthCookie;
    if (!parsed?.state || !parsed.name || !parsed.country) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', `/api/enable-banking/callback?${req.nextUrl.searchParams.toString()}`);
    return NextResponse.redirect(login);
  }

  const error = req.nextUrl.searchParams.get('error');
  if (error) {
    return dashboardRedirect(req, { banking: 'denied' });
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const pending = parseCookie(req.cookies.get(EB_OAUTH_COOKIE)?.value);

  if (!code || !state || !pending || pending.state !== state) {
    return dashboardRedirect(req, { banking: 'error', reason: 'state' });
  }

  try {
    const creds = await requireEnableBankingCreds(user.id);
    const session = await authorizeEnableBankingSession(creds, code);
    const saved = await persistEnableBankingSession(supabase, user.id, session, {
      name: pending.name,
      country: pending.country,
    });
    if (saved === 0) {
      return dashboardRedirect(req, { banking: 'empty' });
    }
    await syncAllBalances(supabase, user.id).catch(() => undefined);
    return dashboardRedirect(req, { banking: 'ok' });
  } catch {
    return dashboardRedirect(req, { banking: 'error', reason: 'session' });
  }
}
