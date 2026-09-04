import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSignalEvaluation } from '@/lib/financial/signals/evaluate';

// Triggered by the "Verifică semnale" action — runs every detector for the
// user synchronously (no queue). See lib/financial/signals/evaluate.ts.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const result = await runSignalEvaluation(supabase, user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
