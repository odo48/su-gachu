import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EnableBankingNotConfiguredError, getEnableBankingAspsps } from '@/lib/enable-banking/client';
import { requireEnableBankingCreds } from '@/lib/enable-banking/connection';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const country = (req.nextUrl.searchParams.get('country') || 'RO').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'Țara trebuie să fie un cod ISO de 2 litere.' }, { status: 400 });
  }
  const psuType = req.nextUrl.searchParams.get('psu_type') === 'business' ? 'business' : 'personal';

  try {
    const creds = await requireEnableBankingCreds(user.id);
    const aspsps = await getEnableBankingAspsps(creds, country, psuType);
    aspsps.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    return NextResponse.json({ configured: true, aspsps });
  } catch (err) {
    if (err instanceof EnableBankingNotConfiguredError) {
      return NextResponse.json({ error: err.message, configured: false }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Nu am putut încărca lista de bănci.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
