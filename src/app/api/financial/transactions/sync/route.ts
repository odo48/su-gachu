import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EnableBankingNotConfiguredError } from '@/lib/enable-banking/jwt';
import { syncAllTransactions } from '@/lib/enable-banking/sync';

// Mirrors jarvis-backend's Controller/Financial/SyncTransactionsController.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dateFrom = typeof body?.date_from === 'string' ? body.date_from.trim() : '';
  const dateTo = typeof body?.date_to === 'string' ? body.date_to.trim() : '';
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'date_from and date_to are required.' }, { status: 400 });
  }

  const accountId = body?.account_id !== undefined && body.account_id !== null && body.account_id !== '' ? Number(body.account_id) : undefined;

  let results;
  try {
    results = await syncAllTransactions(supabase, user.id, { accountId, dateFrom, dateTo });
  } catch (err) {
    if (err instanceof EnableBankingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 404 });
  }

  return NextResponse.json({
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
