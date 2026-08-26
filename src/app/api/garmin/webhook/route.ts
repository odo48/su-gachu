import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSb } from '@supabase/supabase-js';

// Unused for Garmin Connect email/password sync (see /api/garmin/connection).
// Kept for a future official Health API push partnership.

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Garmin trimite array-uri per tip de date. Exemplu pt 'dailies':
  for (const d of body.dailies ?? []) {
    const { data: tok } = await admin
      .from('garmin_tokens').select('user_id')
      .eq('garmin_user_id', d.userId).maybeSingle();
    if (!tok) continue;

    await admin.from('daily_metrics').upsert({
      user_id: tok.user_id,
      date: d.calendarDate,
      source: 'garmin',
      steps: d.steps,
      active_kcal: d.activeKilocalories,
      resting_hr: d.restingHeartRateInBeatsPerMinute,
      avg_hr: d.averageHeartRateInBeatsPerMinute,
      raw: d,
    }, { onConflict: 'user_id,date,source' });
  }
  // sleeps → sleep_minutes, hrv ; vezi docs Garmin pentru câmpuri exacte.

  return NextResponse.json({ ok: true });
}
