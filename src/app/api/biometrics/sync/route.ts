import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncUltrahumanDailyMetrics } from '@/lib/ultrahuman/sync';

// Mirrors jarvis-backend's Controller/Ultrahuman/SyncDailyMetricsController
// (POST /ultrahuman/sync-daily-metrics). Defaults to today, same as jarvis.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date = typeof body?.date === 'string' && body.date.trim() ? body.date.trim() : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: `Invalid date format: ${date}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: token, error: tokenError } = await admin.rpc('get_ultrahuman_token', { p_user_id: user.id });
  if (tokenError || !token) {
    return NextResponse.json({ error: 'No Ultrahuman connection configured for this account.' }, { status: 400 });
  }

  const result = await syncUltrahumanDailyMetrics(supabase, user.id, token, date);

  return NextResponse.json(
    { success: result.status === 'success', skipped: result.status === 'skipped', message: result.message, date },
    { status: result.status === 'failure' ? 422 : 200 }
  );
}
