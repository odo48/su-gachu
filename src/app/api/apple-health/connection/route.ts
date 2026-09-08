import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasGarminConnection } from '@/lib/garmin/metrics';
import { hasUltrahumanConnection } from '@/lib/ultrahuman/connection';
import { generateAppleHealthToken, hashAppleHealthToken } from '@/lib/apple-health/connection';

export const runtime = 'nodejs';

// Manages the caller's Apple Watch (iOS Shortcut) connection. The Shortcut
// authenticates to /api/apple-health/ingest with a bearer token; we keep
// only its hash. Mirrors /api/biometrics/connection (Ultrahuman).

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('apple_health_connections')
    .select('device_name, last_synced_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    connected: !!data,
    deviceName: data?.device_name ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
  });
}

// Issues (or re-issues) the token. Returns the plaintext once — it is never
// stored or shown again.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const token = generateAppleHealthToken();
  const admin = createAdminClient();
  const { error } = await admin.from('apple_health_connections').upsert(
    { user_id: user.id, token_hash: hashAppleHealthToken(token), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'biometrics', enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ token, ingestUrl: `${req.nextUrl.origin}/api/apple-health/ingest` });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('apple_health_connections').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const keepOn =
    (await hasGarminConnection(supabase, user.id)) || (await hasUltrahumanConnection(supabase, user.id));
  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'biometrics', enabled: keepOn, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ ok: true });
}
