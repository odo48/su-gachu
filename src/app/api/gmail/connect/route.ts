import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GmailNotConfiguredError, buildConsentUrl, getGmailAppCreds } from '@/lib/gmail/client';
import { GMAIL_OAUTH_COOKIE, gmailCallbackUrl, gmailOAuthCookieOptions } from '@/lib/gmail/oauth';

export const runtime = 'nodejs';

// Mirrors src/app/api/enable-banking/auth/route.ts: starts the consent
// redirect and sets a state cookie the callback verifies.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const creds = getGmailAppCreds();
    const state = randomUUID();
    const redirectUri = gmailCallbackUrl(req.nextUrl.origin);
    const url = buildConsentUrl(creds, { redirectUri, state });

    const res = NextResponse.json({ url });
    res.cookies.set(GMAIL_OAUTH_COOKIE, JSON.stringify({ state }), gmailOAuthCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof GmailNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Nu am putut porni conectarea Gmail.' }, { status: 502 });
  }
}
