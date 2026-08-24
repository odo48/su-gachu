import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllBalances } from '@/lib/enable-banking/sync';

// Mirrors jarvis-backend's Controller/Financial/SyncAccountBalancesController.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const results = await syncAllBalances(supabase, user.id);

  return NextResponse.json({
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
