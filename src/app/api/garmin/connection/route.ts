import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GarminMfaNeededError, loginGarmin, readProfile, serializeSecret } from '@/lib/garmin/client';
import { hasUltrahumanConnection } from '@/lib/ultrahuman/connection';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('garmin_connections')
    .select('email, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    connected: !!data,
    email: data?.email ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email și parolă Garmin sunt obligatorii.' }, { status: 400 });
  }

  let client;
  try {
    client = await loginGarmin(email, password);
  } catch (err) {
    if (err instanceof GarminMfaNeededError) {
      return NextResponse.json(
        { error: err.message, mfaRequired: true },
        { status: 409 }
      );
    }
    const msg = err instanceof Error ? err.message : 'Login Garmin eșuat.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let garminUserId: string | null = null;
  try {
    const profile = await readProfile(client);
    garminUserId = profile.garminUserId;
  } catch {
    // profile is optional — login already succeeded
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('upsert_garmin_connection', {
    p_user_id: user.id,
    p_email: email,
    p_secret: serializeSecret(password, client),
    p_garmin_user_id: garminUserId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'biometrics', enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.rpc('delete_garmin_connection', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const keepOn = await hasUltrahumanConnection(supabase, user.id);
  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'biometrics', enabled: keepOn, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ ok: true });
}
