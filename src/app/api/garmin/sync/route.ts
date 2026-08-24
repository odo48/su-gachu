/**
 * POST /api/garmin/sync
 * Query:
 *   date=YYYY-MM-DD     — o singură zi (ignoră days)
 *   days=7              — ultimele N zile (default 1 dacă lipsește date)
 *   onlyMissing=true    — sare zilele deja în DB (default true)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lastNDates } from '@/lib/garmin-dates';

const BRAIN_URL  = process.env.BRAIN_URL ?? 'http://localhost:5000';
const MCP_SECRET = process.env.MCP_SECRET ?? '';

export const maxDuration = 60;

async function pullFromBrain(isoDate: string): Promise<Record<string, any>> {
  const url = `${BRAIN_URL}/sync/garmin?date=${isoDate}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Brain-Token': MCP_SECRET },
    signal: AbortSignal.timeout(25_000),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Brain ${res.status}: ${rawText.slice(0, 200)}`);
  }
  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`Răspuns non-JSON: ${rawText.slice(0, 200)}`);
  }
  return data.metrics ?? data;
}

async function saveMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  metrics: Record<string, any>,
) {
  const { error } = await supabase.from('daily_metrics').upsert({
    user_id:       userId,
    date:          metrics.date,
    source:        'garmin',
    steps:         metrics.steps         ?? null,
    active_kcal:   metrics.active_kcal   ?? null,
    resting_hr:    metrics.resting_hr    ?? null,
    avg_hr:        metrics.avg_hr        ?? null,
    sleep_minutes: metrics.sleep_minutes ?? null,
    hrv:           metrics.hrv           ?? null,
    vo2max:        metrics.vo2max        ?? null,
    weight_kg:     metrics.weight_kg     ?? null,
    raw:           metrics.raw           ?? null,
  }, { onConflict: 'user_id,date,source' });

  if (error) throw new Error(error.message);

  if (metrics.weight_kg) {
    await supabase.from('profiles')
      .update({ weight_kg: metrics.weight_kg })
      .eq('id', userId);
  }
}

function hasMetricData(m: Record<string, any>): boolean {
  const acts = m.raw?.activities;
  const hasActs = Array.isArray(acts) && acts.length > 0;
  return !!(
    hasActs || m.steps || m.active_kcal || m.sleep_minutes || m.avg_hr ||
    m.resting_hr || m.raw?.total_kcal
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const singleDate = req.nextUrl.searchParams.get('date');
  const daysParam  = req.nextUrl.searchParams.get('days');
  const onlyMissing = req.nextUrl.searchParams.get('onlyMissing') !== 'false';

  const days = singleDate
    ? 1
    : Math.min(Math.max(parseInt(daysParam ?? '1', 10) || 1, 1), 14);

  let dates = singleDate ? [singleDate] : lastNDates(days);

  if (onlyMissing && dates.length > 1) {
    const { data: existing } = await supabase
      .from('daily_metrics')
      .select('date')
      .eq('user_id', user.id)
      .eq('source', 'garmin')
      .in('date', dates);

    const have = new Set((existing ?? []).map(r => r.date));
    dates = dates.filter(d => !have.has(d));
  }

  if (dates.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await supabase.from('daily_metrics').select('*')
      .eq('user_id', user.id).eq('date', today).eq('source', 'garmin')
      .maybeSingle();
    return NextResponse.json({
      metrics: row ?? null,
      saved: true,
      synced: 0,
      syncedDates: [],
      skipped: true,
    });
  }

  const syncedDates: string[] = [];
  const failed: { date: string; error: string }[] = [];
  let todayMetrics: Record<string, any> | null = null;
  const today = new Date().toISOString().slice(0, 10);

  for (const iso of dates) {
    try {
      const metrics = await pullFromBrain(iso);
      if (!hasMetricData(metrics)) {
        failed.push({ date: iso, error: 'Garmin nu are date pentru această zi' });
        continue;
      }
      await saveMetrics(supabase, user.id, metrics);
      syncedDates.push(iso);
      if (iso === today) todayMetrics = metrics;
    } catch (e: any) {
      if (e?.name === 'TimeoutError') {
        failed.push({ date: iso, error: 'Timeout' });
      } else {
        failed.push({ date: iso, error: e?.message ?? 'Eroare' });
      }
    }
  }

  if (syncedDates.length === 0) {
    const msg = failed.length
      ? failed.map(f => `${f.date}: ${f.error}`).join('; ')
      : 'Nicio zi sincronizată';
    return NextResponse.json({ error: msg, failed, saved: false }, { status: 502 });
  }

  if (!todayMetrics) {
    const { data: row } = await supabase.from('daily_metrics').select('*')
      .eq('user_id', user.id).eq('date', today).eq('source', 'garmin')
      .maybeSingle();
    todayMetrics = row as Record<string, any> | null;
  }

  return NextResponse.json({
    metrics: todayMetrics,
    saved: syncedDates.length > 0,
    synced: syncedDates.length,
    syncedDates,
    failed: failed.length ? failed : undefined,
  });
}
