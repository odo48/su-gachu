import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseEnableBankingPrivateKey } from '@/lib/enable-banking/jwt';

export const runtime = 'nodejs';

const DEFAULT_API_URL = 'https://api.enablebanking.com';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('enable_banking_connections')
    .select('app_id, api_url, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    configured: !!data,
    appId: data?.app_id ?? null,
    apiUrl: data?.api_url ?? DEFAULT_API_URL,
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
  const appId = typeof body?.appId === 'string' ? body.appId.trim() : '';
  const privateKey = typeof body?.privateKey === 'string' ? body.privateKey : '';
  const apiUrl =
    typeof body?.apiUrl === 'string' && body.apiUrl.trim()
      ? body.apiUrl.trim().replace(/\/$/, '')
      : DEFAULT_API_URL;

  if (!appId || !privateKey) {
    return NextResponse.json({ error: 'App ID și cheia PEM sunt obligatorii.' }, { status: 400 });
  }

  try {
    parseEnableBankingPrivateKey(privateKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cheia PEM nu e validă.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('upsert_enable_banking_connection', {
    p_user_id: user.id,
    p_app_id: appId,
    p_secret: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
    p_api_url: apiUrl,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, appId });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.rpc('delete_enable_banking_connection', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
