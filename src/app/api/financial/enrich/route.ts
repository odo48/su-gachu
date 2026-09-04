import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runEnrichment } from '@/lib/financial/enrich';

// Triggered by the "Categorizează" button — runs the rule → transfer-pair →
// income-keyword → agent cascade over a capped batch of signature groups,
// synchronously within this request (no queue). See lib/financial/enrich.ts.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sinceDays = typeof body?.sinceDays === 'number' ? body.sinceDays : undefined;
  const transactionIds = Array.isArray(body?.transactionIds)
    ? body.transactionIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
    : undefined;
  const provider = typeof body?.provider === 'string' ? body.provider : undefined;

  try {
    const result = await runEnrichment(supabase, user.id, { sinceDays, transactionIds, provider });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
