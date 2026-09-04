import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runEmailSync } from '@/lib/financial/email/sync';

// Triggered by the Gmail "Sincronizează" action — chains ingest → screen →
// analyze → signal-creation, capped, synchronously within this request.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sinceHours = typeof body?.sinceHours === 'number' ? body.sinceHours : undefined;
  const provider = typeof body?.provider === 'string' ? body.provider : undefined;

  try {
    const result = await runEmailSync(supabase, user.id, { sinceHours, provider });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
