import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { withSecureCookies } from '@/lib/security/cookies';

const WEBHOOK = '/api/garmin/webhook';

function needsAuth(path: string): boolean {
  if (path.startsWith('/dashboard')) return true;
  if (path.startsWith('/profile')) return true;
  if (path.startsWith('/chat')) return true;
  if (path.startsWith('/api/auth')) return false;
  if (path.startsWith('/api/') && path !== WEBHOOK) return true;
  return false;
}

function forceHttps(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null;
  const proto = request.headers.get('x-forwarded-proto');
  if (proto !== 'http') return null;
  const host = request.headers.get('host');
  if (!host) return null;
  const httpsUrl = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return NextResponse.redirect(httpsUrl, 308);
}

function rateLimitApi(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (!path.startsWith('/api/') || path === WEBHOOK) return null;
  const ip = clientIp(request);
  if (path.startsWith('/api/auth')) {
    if (!rateLimit(`mw-auth:${ip}`, 10, 15 * 60_000)) {
      return NextResponse.json({ error: 'Prea multe încercări. Reîncearcă în 15 minute.' }, { status: 429 });
    }
    return null;
  }
  if (!rateLimit(`mw-api:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou imediat.' }, { status: 429 });
  }
  return null;
}

// Reîmprospătează sesiunea la fiecare request și protejează rutele private.
export async function updateSession(request: NextRequest) {
  const https = forceHttps(request);
  if (https) return https;

  const limited = rateLimitApi(request);
  if (limited) return limited;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, withSecureCookies(options))
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && needsAuth(path)) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const login = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    login.pathname = '/login';
    login.search = '';
    if (next && next !== '/' && next !== '/login') {
      login.searchParams.set('next', next);
    }
    return NextResponse.redirect(login);
  }

  if (user && path === '/login') {
    const home = request.nextUrl.clone();
    home.pathname = '/dashboard';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
