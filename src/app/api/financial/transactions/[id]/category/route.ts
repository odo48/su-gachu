import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mirrors jarvis-backend's Controller/Financial/RemoveTransactionCategoryController.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const transactionId = Number(id);
  if (!Number.isInteger(transactionId)) {
    return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('transactions')
    .update({ category_id: null, tags: null, notes: null })
    .eq('id', transactionId)
    .eq('user_id', user.id)
    .select('*, accounts!inner(bank, currency), categories(id, name)')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: `Transaction ${transactionId} not found.` }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    bank: data.accounts?.bank ?? '',
    accountCurrencyCode: data.accounts?.currency ?? '',
    amount: Number(data.amount),
    currencyCode: data.currency,
    creditorName: data.creditor_name ?? '',
    debtorName: data.debtor_name ?? '',
    code: data.bank_transaction_code ?? '',
    type: data.credit_debit_indicator,
    description: data.remittance_information ?? '',
    date: data.booking_date,
    categoryId: null,
    tags: null,
    notes: null,
  });
}
