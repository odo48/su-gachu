import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mirrors jarvis-backend's Controller/Financial/ListAccountsController (GET).
// POST is new: jarvis had no account-linking flow at all (Account rows were
// created out-of-band after a manual Enable Banking consent) — this lets a
// user register an already-linked account_id manually until a real
// consent/callback flow exists. Also flips the financial module on, same as
// the connect flows for home_assistant/biometrics.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const bank = req.nextUrl.searchParams.get('bank');
  const currency = req.nextUrl.searchParams.get('currency');

  let query = supabase
    .from('accounts')
    .select('id, account_id, bank, currency, balance, iban')
    .eq('user_id', user.id);
  if (bank) query = query.ilike('bank', `%${bank}%`);
  if (currency) query = query.eq('currency', currency);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((a) => ({
      id: a.id,
      accountId: a.id,
      externalAccountId: a.account_id,
      bank: a.bank,
      currencyCode: a.currency,
      balance: Number(a.balance),
      iban: a.iban,
    }))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { accountId, bank, currency, iban } = body ?? {};
  if (!accountId || !bank || !currency || !iban) {
    return NextResponse.json({ error: '"accountId", "bank", "currency" and "iban" are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: user.id, account_id: accountId, bank, currency, iban })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from('user_modules')
    .upsert(
      { user_id: user.id, module: 'financial', enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: '"id" is required' }, { status: 400 });

  const { error } = await supabase.from('accounts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: remaining } = await supabase.from('accounts').select('id').eq('user_id', user.id).limit(1);
  if ((remaining ?? []).length === 0) {
    await supabase
      .from('user_modules')
      .upsert(
        { user_id: user.id, module: 'financial', enabled: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,module' }
      );
  }

  return NextResponse.json({ ok: true });
}
