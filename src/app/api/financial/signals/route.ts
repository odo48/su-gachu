import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Lists financial_signals for the SignalsPanel, filterable by status
// (defaults to open ones: detected/confirmed).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status');
  let query = supabase
    .from('financial_signals')
    .select('id, type, status, priority, expected_value, expected_by_date, matched_transaction_id, confidence, created_at, resolved_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  query = status ? query.eq('status', status) : query.in('status', ['detected', 'confirmed']);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
