import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSb } from '@supabase/supabase-js';

// Unused for Garmin Connect email/password sync (see /api/garmin/connection).
// Kept for a future official Health API push partnership.

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function webhookAuthorized(req: NextRequest): boolean {
  const secret = process.env.GARMIN_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-webhook-secret') ?? '';
  const bearer = req.headers.get('authorization') ?? '';
  const token = bearer.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : '';
  return header === secret || token === secret;
}

export async function POST(req: NextRequest) {
  if (!webhookAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const payload = body as { dailies?: Array<Record<string, unknown> & { userId?: string; calendarDate?: string; steps?: number; activeKilocalories?: number; restingHeartRateInBeatsPerMinute?: number; averageHeartRateInBeatsPerMinute?: number }> };

  // Garmin trimite array-uri per tip de date. Exemplu pt 'dailies':
  for (const d of payload.dailies ?? []) {
    const { data: tok } = await admin
      .from('garmin_tokens').select('user_id')
      .eq('garmin_user_id', d.userId).maybeSingle();
    if (!tok) continue;

    await admin.from('garmin_daily_biometrics').upsert({
      user_id: tok.user_id,
      date: d.calendarDate,
      steps: d.steps,
      active_kcal: d.activeKilocalories,
      resting_hr: d.restingHeartRateInBeatsPerMinute,
      avg_hr: d.averageHeartRateInBeatsPerMinute,
      raw: d,
    }, { onConflict: 'user_id,date' });
  }
  // sleeps → sleep_minutes, hrv ; vezi docs Garmin pentru câmpuri exacte.

  return NextResponse.json({ ok: true });
}
