import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EnableBankingNotConfiguredError } from '@/lib/enable-banking/jwt';
import { syncAllBalances } from '@/lib/enable-banking/sync';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const results = await syncAllBalances(supabase, user.id);
    return NextResponse.json({
      synced: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err) {
    if (err instanceof EnableBankingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
