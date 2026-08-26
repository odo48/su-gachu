import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchDayMetrics,
  fetchRecentActivities,
  hasMetricData,
  loginGarmin,
  parseSecret,
  readProfile,
  serializeSecret,
} from '@/lib/garmin/client';
import { isoDateLocal, lastNDates } from '@/lib/garmin/dates';
import { saveGarminDayMetrics } from '@/lib/garmin/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: secretRaw, error: secretError } = await admin.rpc('get_garmin_secret', {
    p_user_id: user.id,
  });
  if (secretError || !secretRaw) {
    return NextResponse.json(
      { error: 'Garmin nu e conectat. Adaugă emailul și parola pe Profil.' },
      { status: 400 }
    );
  }

  const { data: connection } = await supabase
    .from('garmin_connections')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!connection?.email) {
    return NextResponse.json({ error: 'Garmin nu e conectat.' }, { status: 400 });
  }

  let secret;
  try {
    secret = parseSecret(secretRaw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Secret Garmin invalid.' },
      { status: 500 }
    );
  }

  let client;
  try {
    client = await loginGarmin(connection.email, secret.password, secret.tokens);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Login Garmin eșuat.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  try {
    await admin.rpc('upsert_garmin_connection', {
      p_user_id: user.id,
      p_email: connection.email,
      p_secret: serializeSecret(secret.password, client),
    });
  } catch {
    // token refresh persist is best-effort
  }

  const singleDate = req.nextUrl.searchParams.get('date');
  const daysParam = req.nextUrl.searchParams.get('days');
  const onlyMissing = req.nextUrl.searchParams.get('onlyMissing') !== 'false';

  const days = singleDate ? 1 : Math.min(Math.max(parseInt(daysParam ?? '7', 10) || 7, 1), 14);
  let dates = singleDate ? [singleDate] : lastNDates(days);

  if (onlyMissing && dates.length > 1) {
    const { data: existing } = await supabase
      .from('daily_metrics')
      .select('date')
      .eq('user_id', user.id)
      .eq('source', 'garmin')
      .in('date', dates);
    const have = new Set((existing ?? []).map((r) => r.date));
    dates = dates.filter((d) => !have.has(d));
  }

  if (dates.length === 0) {
    const today = isoDateLocal();
    const { data: row } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('source', 'garmin')
      .maybeSingle();
    return NextResponse.json({
      metrics: row ?? null,
      saved: true,
      synced: 0,
      syncedDates: [],
      skipped: true,
    });
  }

  let displayName = '';
  let vo2max: number | null = null;
  try {
    const profile = await readProfile(client);
    displayName = profile.displayName;
    vo2max = profile.vo2max;
  } catch {
    // summary endpoint needs displayName; other calls still work
  }

  const recentActivities = await fetchRecentActivities(client);

  const syncedDates: string[] = [];
  const failed: { date: string; error: string }[] = [];
  let todayMetrics = null;
  const today = isoDateLocal();

  for (const iso of dates) {
    try {
      const metrics = await fetchDayMetrics(client, iso, displayName, vo2max, recentActivities);
      if (!hasMetricData(metrics)) {
        failed.push({ date: iso, error: 'Garmin nu are date pentru această zi' });
        continue;
      }
      await saveGarminDayMetrics(supabase, user.id, metrics);
      syncedDates.push(iso);
      if (iso === today) todayMetrics = metrics;
    } catch (e) {
      failed.push({ date: iso, error: e instanceof Error ? e.message : 'Eroare' });
    }
    await sleep(400);
  }

  if (syncedDates.length === 0) {
    const msg = failed.length
      ? failed.map((f) => `${f.date}: ${f.error}`).join('; ')
      : 'Nicio zi sincronizată';
    return NextResponse.json({ error: msg, failed, saved: false }, { status: 502 });
  }

  if (!todayMetrics) {
    const { data: row } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('source', 'garmin')
      .maybeSingle();
    todayMetrics = row;
  }

  return NextResponse.json({
    metrics: todayMetrics,
    saved: true,
    synced: syncedDates.length,
    syncedDates,
    failed: failed.length ? failed : undefined,
  });
}
