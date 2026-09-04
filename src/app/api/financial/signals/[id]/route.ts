import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transitionSignal } from '@/lib/financial/signals/lifecycle';

const ALLOWED_STATUSES = new Set(['resolved', 'dismissed']);

// PATCH { status: 'resolved' | 'dismissed' } — the only transitions a user
// can trigger directly from SignalsPanel; detectors own the rest.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const signalId = Number(id);
  if (!Number.isInteger(signalId)) {
    return NextResponse.json({ error: 'Invalid signal id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "status must be 'resolved' or 'dismissed'" }, { status: 400 });
  }

  try {
    await transitionSignal(supabase, user.id, signalId, status, body?.note);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
