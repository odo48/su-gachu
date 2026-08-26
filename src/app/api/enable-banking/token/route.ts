import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireEnableBankingCreds } from '@/lib/enable-banking/connection';
import { EnableBankingNotConfiguredError, generateEnableBankingToken } from '@/lib/enable-banking/jwt';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const creds = await requireEnableBankingCreds(user.id);
    return NextResponse.json({ token: generateEnableBankingToken(creds) });
  } catch (err) {
    if (err instanceof EnableBankingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Enable Banking token failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
