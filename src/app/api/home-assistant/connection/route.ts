import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Manages the caller's own Home Assistant connection (mcp_url + access
// token). The token is never stored in a plain column or returned by GET —
// writes/reads of the actual secret go through the Vault-backed
// upsert_ha_connection()/get_ha_token() functions in
// supabase/schema_home_assistant.sql, callable only by service_role.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('home_assistant_connections')
    .select('mcp_url, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connected: !!data, mcpUrl: data?.mcp_url ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const mcpUrl = body?.mcpUrl;
  const token = body?.token;
  if (!mcpUrl || typeof mcpUrl !== 'string' || !token || typeof token !== 'string') {
    return NextResponse.json({ error: '"mcpUrl" and "token" are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('upsert_ha_connection', {
    p_user_id: user.id,
    p_mcp_url: mcpUrl,
    p_token: token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'home_assistant', enabled: true, updated_at: new Date().toISOString() },
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
  const { error } = await admin.rpc('delete_ha_connection', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'home_assistant', enabled: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json({ ok: true });
}
