import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GmailNotConfiguredError, exchangeAuthCode, getGmailAppCreds } from '@/lib/gmail/client';
import { GMAIL_OAUTH_COOKIE, gmailCallbackUrl, gmailOAuthCookieOptions } from '@/lib/gmail/oauth';

export const runtime = 'nodejs';

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = '/dashboard';
  url.search = '';
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = NextResponse.redirect(url);
  res.cookies.set(GMAIL_OAUTH_COOKIE, '', gmailOAuthCookieOptions(0));
  return res;
}

function parseCookie(raw: string | undefined): { state: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: string };
    return parsed?.state ? { state: parsed.state } : null;
  } catch {
    return null;
  }
}

// Mirrors src/app/api/enable-banking/callback/route.ts.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', `/api/gmail/callback?${req.nextUrl.searchParams.toString()}`);
    return NextResponse.redirect(login);
  }

  const error = req.nextUrl.searchParams.get('error');
  if (error) return dashboardRedirect(req, { gmail: 'denied' });

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const pending = parseCookie(req.cookies.get(GMAIL_OAUTH_COOKIE)?.value);

  if (!code || !state || !pending || pending.state !== state) {
    return dashboardRedirect(req, { gmail: 'error', reason: 'state' });
  }

  try {
    const creds = getGmailAppCreds();
    const redirectUri = gmailCallbackUrl(req.nextUrl.origin);
    const { emailAddress, refreshToken } = await exchangeAuthCode(creds, { code, redirectUri });

    const admin = createAdminClient();
    const { error: rpcError } = await admin.rpc('upsert_gmail_connection', {
      p_user_id: user.id,
      p_email: emailAddress,
      p_refresh_token: refreshToken,
    });
    if (rpcError) throw new Error(rpcError.message);

    return dashboardRedirect(req, { gmail: 'ok' });
  } catch (err) {
    if (err instanceof GmailNotConfiguredError) return dashboardRedirect(req, { gmail: 'error', reason: 'not_configured' });
    return dashboardRedirect(req, { gmail: 'error', reason: 'session' });
  }
}
