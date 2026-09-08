import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { translateAppleHealthToCommon, upsertCommonBiometrics } from '../biometrics/translate';

// Payload contract for POST /api/apple-health/ingest, produced by the
// "Su Gachu Health Sync" iOS Shortcut (see docs/apple-health-shortcut.md).
// Everything except `date` is optional — the Watch may not have synced a
// given metric, and pre-iOS-16 watches have no sleep stages.

const sleepSchema = z
  .object({
    // Shortcuts' date formatting varies (offset / Z / none); accept any
    // string and coerce in ingestAppleHealth, since these are display-only.
    start: z.string().max(40).optional(),
    end: z.string().max(40).optional(),
    in_bed_min: z.number().min(0).max(1440).optional(),
    asleep_min: z.number().min(0).max(1440).optional(),
    core_min: z.number().min(0).max(1440).optional(),
    deep_min: z.number().min(0).max(1440).optional(),
    rem_min: z.number().min(0).max(1440).optional(),
    awake_min: z.number().min(0).max(1440).optional(),
  })
  .nullable()
  .optional();

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().min(0).max(200_000).optional(),
  active_energy_kcal: z.number().min(0).max(20_000).optional(),
  exercise_minutes: z.number().min(0).max(1440).optional(),
  resting_hr: z.number().min(20).max(200).optional(),
  avg_hr: z.number().min(20).max(240).optional(),
  min_hr: z.number().min(20).max(240).optional(),
  max_hr: z.number().min(20).max(260).optional(),
  hrv_sdnn_ms: z.number().min(0).max(500).optional(),
  vo2max: z.number().min(0).max(100).optional(),
  respiratory_rate: z.number().min(0).max(60).optional(),
  spo2_avg: z.number().min(50).max(100).optional(),
  weight_kg: z.number().min(20).max(400).optional(),
  sleep: sleepSchema,
});

export const appleHealthPayloadSchema = z.object({
  device_name: z.string().max(120).optional(),
  days: z.array(daySchema).min(1).max(31),
});

export type AppleHealthPayload = z.infer<typeof appleHealthPayloadSchema>;
export type AppleHealthDay = z.infer<typeof daySchema>;

function round(n: number | undefined, digits = 0): number | null {
  if (n == null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function toIso(s: string | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// Uses the service-role client (the ingest route has no user session — it
// authenticates the Shortcut by token). Writes the raw row, then translates
// into the common daily_biometrics table, same two-step every provider sync
// does (see src/lib/garmin/sync.ts, src/lib/ultrahuman/sync.ts).
export async function ingestAppleHealth(
  supabase: SupabaseClient,
  userId: string,
  payload: AppleHealthPayload
): Promise<{ days: number }> {
  let latestWeight: number | null = null;
  let latestWeightDate = '';

  for (const day of payload.days) {
    const row = {
      user_id: userId,
      date: day.date,
      steps: round(day.steps),
      active_kcal: round(day.active_energy_kcal),
      exercise_min: round(day.exercise_minutes),
      resting_hr: round(day.resting_hr),
      avg_hr: round(day.avg_hr),
      min_hr: round(day.min_hr),
      max_hr: round(day.max_hr),
      hrv: round(day.hrv_sdnn_ms),
      vo2max: round(day.vo2max, 1),
      respiratory_rate: round(day.respiratory_rate, 1),
      spo2_avg: round(day.spo2_avg, 1),
      weight_kg: round(day.weight_kg, 1),
      sleep_start: toIso(day.sleep?.start),
      sleep_end: toIso(day.sleep?.end),
      in_bed_min: round(day.sleep?.in_bed_min),
      asleep_min: round(day.sleep?.asleep_min),
      core_min: round(day.sleep?.core_min),
      deep_min: round(day.sleep?.deep_min),
      rem_min: round(day.sleep?.rem_min),
      awake_min: round(day.sleep?.awake_min),
      raw: day as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('apple_health_daily_biometrics')
      .upsert(row, { onConflict: 'user_id,date' });
    if (error) throw new Error(error.message);

    await upsertCommonBiometrics(supabase, userId, day.date, translateAppleHealthToCommon(day), 'apple_health');

    if (row.weight_kg != null && day.date >= latestWeightDate) {
      latestWeight = row.weight_kg;
      latestWeightDate = day.date;
    }
  }

  if (latestWeight != null) {
    await supabase.from('profiles').update({ weight_kg: latestWeight }).eq('id', userId);
  }

  return { days: payload.days.length };
}
