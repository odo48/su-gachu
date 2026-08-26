import type { SupabaseClient } from '@supabase/supabase-js';
import { flattenGarminRaw } from './raw';
import { isoDateLocal } from './dates';
import { parseGarminActivities } from '@/lib/sport';

type MetricRow = {
  date: string;
  steps?: number | null;
  active_kcal?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  sleep_minutes?: number | null;
  hrv?: number | null;
  vo2max?: number | null;
  weight_kg?: number | null;
  raw?: Record<string, unknown> | null;
};

function hoursFromMinutes(min?: number | null): number | null {
  return min != null ? Math.round((min / 60) * 10) / 10 : null;
}

function minsFromSeconds(sec?: number | null): number | null {
  return sec != null ? Math.round(sec / 60) : null;
}

export function mapGarminMetricRow(row: MetricRow) {
  const raw = flattenGarminRaw((row.raw ?? {}) as Record<string, unknown>);
  const activities = parseGarminActivities(raw);

  return {
    source: 'garmin' as const,
    date: row.date,
    steps: row.steps ?? null,
    activeKcal: row.active_kcal ?? null,
    restingHr: row.resting_hr ?? null,
    avgHr: row.avg_hr ?? null,
    hrvMs: row.hrv ?? null,
    vo2max: row.vo2max ?? null,
    weightKg: row.weight_kg ?? null,
    sleepHours: hoursFromMinutes(row.sleep_minutes),
    sleepMinutes: row.sleep_minutes ?? null,
    sleepScore: (raw.sleep_score as number | null) ?? null,
    sleepStages: {
      deepMinutes: minsFromSeconds(raw.deep_sleep_seconds as number | null),
      lightMinutes: minsFromSeconds(raw.light_sleep_seconds as number | null),
      remMinutes: minsFromSeconds(raw.rem_sleep_seconds as number | null),
      awakeMinutes: minsFromSeconds(raw.awake_sleep_seconds as number | null),
    },
    stressAvg: (raw.stress_avg as number | null) ?? null,
    stressMax: (raw.stress_max as number | null) ?? null,
    bodyBatteryHigh: (raw.body_battery_high as number | null) ?? null,
    bodyBatteryLow: (raw.body_battery_low as number | null) ?? null,
    totalKcal: (raw.total_kcal as number | null) ?? null,
    bmrKcal: (raw.bmr_kcal as number | null) ?? null,
    distanceKm:
      raw.distance_m != null ? Math.round((Number(raw.distance_m) / 1000) * 10) / 10 : null,
    activities: activities.map((a) => ({
      name: a.name,
      type: a.type_key,
      durationMin: a.duration_min,
      calories: a.calories,
      avgHr: a.avg_hr,
    })),
  };
}

const GARMIN_SELECT =
  'date, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, vo2max, weight_kg, raw';

export async function getLatestGarminMetrics(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('garmin_daily_biometrics')
    .select(GARMIN_SELECT)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapGarminMetricRow(data as MetricRow) : null;
}

export async function getGarminMetricTrends(supabase: SupabaseClient, userId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days));
  const sinceIso = isoDateLocal(since);

  const { data, error } = await supabase
    .from('garmin_daily_biometrics')
    .select(GARMIN_SELECT)
    .eq('user_id', userId)
    .gte('date', sinceIso)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapGarminMetricRow(row as MetricRow));
}

export async function hasGarminConnection(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('garmin_connections')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
