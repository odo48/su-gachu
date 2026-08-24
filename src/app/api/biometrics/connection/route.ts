import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Manages the caller's own Ultrahuman API token. Mirrors
// /api/home-assistant/connection — the token goes through Vault via
// upsert_ultrahuman_connection()/get_ultrahuman_token() in
// supabase/schema_biometrics.sql, never a plain column.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('ultrahuman_connections')
    .select('updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connected: !!data, updatedAt: data?.updated_at ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: '"token" is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('upsert_ultrahuman_connection', { p_user_id: user.id, p_token: token });
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
  const { error } = await admin.rpc('delete_ultrahuman_connection', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'biometrics', enabled: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ ok: true });
}
