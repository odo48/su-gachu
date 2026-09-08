import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashAppleHealthToken } from '@/lib/apple-health/connection';
import { appleHealthPayloadSchema, ingestAppleHealth } from '@/lib/apple-health/ingest';

export const runtime = 'nodejs';

// Bearer-token endpoint hit by the "Su Gachu Health Sync" iOS Shortcut — no
// user session. The token identifies the user (its hash is in
// apple_health_connections); we use the service-role client to look it up
// and write, same as /api/garmin/webhook.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from('apple_health_connections')
    .select('user_id')
    .eq('token_hash', hashAppleHealthToken(token))
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = appleHealthPayloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', details: parsed.error.issues }, { status: 400 });
  }

  let result: { days: number };
  try {
    result = await ingestAppleHealth(admin, conn.user_id, parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 422 });
  }

  await admin
    .from('apple_health_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      ...(parsed.data.device_name ? { device_name: parsed.data.device_name } : {}),
    })
    .eq('user_id', conn.user_id);

  return NextResponse.json({ ok: true, days: result.days, message: `Synced ${result.days} day(s)` });
}
