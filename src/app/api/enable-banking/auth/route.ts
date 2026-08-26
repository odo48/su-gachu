import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  EnableBankingNotConfiguredError,
  consentValidUntilIso,
  getEnableBankingAspsps,
  startEnableBankingAuth,
} from '@/lib/enable-banking/client';
import { requireEnableBankingCreds } from '@/lib/enable-banking/connection';
import {
  EB_OAUTH_COOKIE,
  ebOAuthCookieOptions,
  enableBankingCallbackUrl,
  originFromRequest,
} from '@/lib/enable-banking/oauth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const country = typeof body?.country === 'string' ? body.country.trim().toUpperCase() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const psuType = body?.psuType === 'business' ? 'business' : 'personal';

  if (!/^[A-Z]{2}$/.test(country) || !name) {
    return NextResponse.json({ error: 'Alege țara și banca.' }, { status: 400 });
  }

  const redirectUrl = enableBankingCallbackUrl(originFromRequest(req.nextUrl.origin, body?.origin));
  const state = randomUUID();

  try {
    const creds = await requireEnableBankingCreds(user.id);
    const aspsps = await getEnableBankingAspsps(creds, country, psuType);
    const aspsp = aspsps.find((a) => a.name === name);
    if (!aspsp) {
      return NextResponse.json({ error: 'Banca nu e disponibilă pentru țara aleasă.' }, { status: 400 });
    }

    const started = await startEnableBankingAuth(creds, {
      aspspName: aspsp.name,
      aspspCountry: aspsp.country,
      redirectUrl,
      state,
      psuType,
      validUntilIso: consentValidUntilIso(aspsp.maximumConsentValidity),
    });

    if (!started?.url) {
      return NextResponse.json({ error: 'Enable Banking nu a returnat un URL de autorizare.' }, { status: 502 });
    }

    const res = NextResponse.json({ url: started.url });
    res.cookies.set(
      EB_OAUTH_COOKIE,
      JSON.stringify({ state, name: aspsp.name, country: aspsp.country, psuType }),
      ebOAuthCookieOptions()
    );
    return res;
  } catch (err) {
    if (err instanceof EnableBankingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Nu am putut porni conectarea la bancă.';
    if (message.includes('REDIRECT_URI_NOT_ALLOWED')) {
      return NextResponse.json(
        {
          error: `Redirect URI not allowed. În Enable Banking Control Panel → aplicația ta → Redirect URLs, adaugă exact (fără slash la final):\n${redirectUrl}`,
          redirectUrl,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
