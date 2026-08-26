import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function loginErrorRedirect(origin: string, reason: string) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', 'oauth');
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error');
  const nextParam = searchParams.get('next') ?? '/profile';
  const next = nextParam.startsWith('/') ? nextParam : '/profile';

  if (oauthError && !code) {
    return loginErrorRedirect(origin, oauthError);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocal = process.env.NODE_ENV === 'development';
      if (isLocal) return NextResponse.redirect(`${origin}${next}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return loginErrorRedirect(origin, error.message);
  }

  return loginErrorRedirect(origin, 'missing_code');
}
