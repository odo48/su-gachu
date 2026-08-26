import type { SupabaseClient } from '@supabase/supabase-js';
import type { GarminDayMetrics } from './types';
import { translateGarminToCommon, upsertCommonBiometrics } from '../biometrics/translate';

export async function saveGarminDayMetrics(
  supabase: SupabaseClient,
  userId: string,
  metrics: GarminDayMetrics
) {
  const { error } = await supabase.from('garmin_daily_biometrics').upsert(
    {
      user_id: userId,
      date: metrics.date,
      steps: metrics.steps,
      active_kcal: metrics.active_kcal,
      resting_hr: metrics.resting_hr,
      avg_hr: metrics.avg_hr,
      sleep_minutes: metrics.sleep_minutes,
      hrv: metrics.hrv,
      vo2max: metrics.vo2max,
      weight_kg: metrics.weight_kg,
      raw: metrics.raw,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  );
  if (error) throw new Error(error.message);

  await upsertCommonBiometrics(supabase, userId, metrics.date, translateGarminToCommon(metrics), 'garmin');

  if (metrics.weight_kg) {
    await supabase.from('profiles').update({ weight_kg: metrics.weight_kg }).eq('id', userId);
  }
}
