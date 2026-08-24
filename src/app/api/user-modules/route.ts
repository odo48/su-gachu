import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Per-user module enablement — see supabase/schema_modules.sql for why this
// exists instead of a generic feature-flag framework. GET lists all modules
// and their state for the caller; PATCH toggles one.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('user_modules').select('module, enabled').eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const moduleName = body?.module;
  const enabled = body?.enabled;
  if (typeof moduleName !== 'string' || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: '"module" (string) and "enabled" (boolean) are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: moduleName, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
