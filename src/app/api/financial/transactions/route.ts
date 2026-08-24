import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTransactions } from '@/lib/financial/tools';

// Mirrors jarvis-backend's Controller/Financial/ListTransactionsController,
// including its pagination shape (page/limit/total/totalPages), but delegates
// filtering/sorting to the same getTransactions() the agent's get_transactions
// tool uses so the two never drift apart.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit') ?? DEFAULT_LIMIT)));
  const accountId = params.get('account_id');
  const categoryId = params.get('category_id');
  const withoutCategory = params.get('without_category');

  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  let items;
  try {
    items = await getTransactions(supabase, user.id, {
      accountId: accountId ? Number(accountId) : undefined,
      creditorName: params.get('creditor_name') ?? undefined,
      debtorName: params.get('debtor_name') ?? undefined,
      since: params.get('date_from') ?? undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      withoutCategory: withoutCategory !== null ? withoutCategory === 'true' : undefined,
      sort: params.get('sort') ?? 'bookingDate',
      order: params.get('order') ?? 'DESC',
      limit,
      page,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    items,
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  });
}
