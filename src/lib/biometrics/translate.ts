import type { SupabaseClient } from '@supabase/supabase-js';

// Translation layer from provider-shaped raw data (garmin_daily_biometrics,
// ultrahuman_daily_biometrics/ultrahuman_sleep_sessions) into the common
// `daily_biometrics` table the dashboard, recommend engine, and the chat
// agent's merged-view tool read from. Each provider sync calls
// upsertCommonBiometrics after writing its own raw table; DailyMetricsForm
// calls it directly since manual entries have no raw payload behind them.

export type CommonBiometricFields = {
  weight_kg?: number | null;
  steps?: number | null;
  active_kcal?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  sleep_minutes?: number | null;
  hrv?: number | null;
  vo2max?: number | null;
};

export type BiometricSource = 'garmin' | 'ultrahuman' | 'manual' | 'apple_health';

// Only non-null fields in `patch` are written, so a partial sync from one
// provider never clobbers another provider's values for the same day.
// Last-synced-wins per field; `sources` records which provider set each one.
export async function upsertCommonBiometrics(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  patch: CommonBiometricFields,
  source: BiometricSource
): Promise<void> {
  const fields: Record<string, number> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value != null) fields[key] = value;
  }
  if (Object.keys(fields).length === 0) return;

  const { data: existing, error: readError } = await supabase
    .from('daily_biometrics')
    .select('sources')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const sources: Record<string, string> = { ...((existing?.sources as Record<string, string> | null) ?? {}) };
  for (const key of Object.keys(fields)) sources[key] = source;

  const { error } = await supabase
    .from('daily_biometrics')
    .upsert(
      { user_id: userId, date, ...fields, sources, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
  if (error) throw new Error(error.message);
}

export function translateGarminToCommon(metrics: {
  steps: number | null;
  active_kcal: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_minutes: number | null;
  hrv: number | null;
  vo2max: number | null;
  weight_kg: number | null;
}): CommonBiometricFields {
  return {
    weight_kg: metrics.weight_kg,
    steps: metrics.steps,
    active_kcal: metrics.active_kcal,
    resting_hr: metrics.resting_hr,
    avg_hr: metrics.avg_hr,
    sleep_minutes: metrics.sleep_minutes,
    hrv: metrics.hrv,
    vo2max: metrics.vo2max,
  };
}

// Apple Watch, via the iOS Shortcut (see src/lib/apple-health/ingest.ts).
// The Shortcut delivers day-grain aggregates whose names already line up
// with the common table; `asleep_min` is the sleep-stage total, not
// time-in-bed. Fields the Watch didn't sync arrive null and are skipped by
// upsertCommonBiometrics, so another provider's value for that day survives.
export function translateAppleHealthToCommon(day: {
  weight_kg?: number | null;
  steps?: number | null;
  active_energy_kcal?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  hrv_sdnn_ms?: number | null;
  vo2max?: number | null;
  sleep?: { asleep_min?: number | null } | null;
}): CommonBiometricFields {
  return {
    weight_kg: day.weight_kg ?? null,
    steps: day.steps ?? null,
    active_kcal: day.active_energy_kcal ?? null,
    resting_hr: day.resting_hr ?? null,
    avg_hr: day.avg_hr ?? null,
    hrv: day.hrv_sdnn_ms ?? null,
    vo2max: day.vo2max ?? null,
    sleep_minutes: day.sleep?.asleep_min ?? null,
  };
}

// Ultrahuman has no weight/active_kcal/avg_hr equivalent (it's a ring, not
// a watch) — those fields are simply omitted so Garmin/manual values for
// them survive untouched. night_rhr_avg is the closest analog to Garmin's
// resting_hr; hrv_last_read to Garmin's hrv.
export function translateUltrahumanToCommon(
  biometrics: {
    steps: number;
    hrv_last_read: number;
    vo2max: number;
    night_rhr_avg: number;
  },
  totalSleepSeconds?: number | null
): CommonBiometricFields {
  return {
    steps: biometrics.steps,
    hrv: biometrics.hrv_last_read,
    vo2max: biometrics.vo2max,
    resting_hr: Math.round(biometrics.night_rhr_avg),
    sleep_minutes: totalSleepSeconds != null ? Math.round(totalSleepSeconds / 60) : null,
  };
}
