import type { SupabaseClient } from '@supabase/supabase-js';
import { getUltrahumanDailyMetrics } from './client';

// Ported from jarvis-backend's Service/Ultrahuman/UltrahumanDailyMetricsSyncService.php.
// Maps Ultrahuman's daily_metrics response (an array of {type, object}
// entries) into daily_biometrics + sleep_sessions rows for the given user.

type UltrahumanMetric = { type: string; object: Record<string, unknown> & Record<string, any> };

function getMetric(metrics: UltrahumanMetric[], type: string): Record<string, any> {
  const metric = metrics.find((m) => m.type === type);
  if (!metric) throw new Error(`Metric "${type}" not found in metrics array.`);
  return metric.object;
}

function valuesOf(obj: Record<string, any>): number[] {
  return (obj.values ?? []).map((v: { value: number }) => v.value);
}

export type SyncResult = { status: 'success' | 'skipped' | 'failure'; message: string };

export async function syncUltrahumanDailyMetrics(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  date: string
): Promise<SyncResult> {
  let response: any;
  try {
    response = await getUltrahumanDailyMetrics(token, date);
  } catch (err) {
    return { status: 'failure', message: err instanceof Error ? err.message : String(err) };
  }

  const metrics: UltrahumanMetric[] = response?.data?.metrics?.[date] ?? [];
  if (metrics.length === 0) {
    return { status: 'skipped', message: `No metrics found for date ${date}` };
  }

  let biometrics: Record<string, number>;
  try {
    const hrValues = valuesOf(getMetric(metrics, 'hr'));
    const spo2Values = valuesOf(getMetric(metrics, 'spo2'));
    const hrvValues = valuesOf(getMetric(metrics, 'hrv'));
    const steps = getMetric(metrics, 'steps');
    const nightRhr = getMetric(metrics, 'night_rhr');
    const nightRhrValues = valuesOf(nightRhr);
    const avgSleepHrv = getMetric(metrics, 'avg_sleep_hrv');
    const sleep = getMetric(metrics, 'sleep');
    const recovery = getMetric(metrics, 'recovery_index');
    const movement = getMetric(metrics, 'movement_index');
    const vo2max = getMetric(metrics, 'vo2_max');

    let restfulness = 0;
    let sleepConsistency = 0;
    for (const contributor of sleep.summary ?? []) {
      if (contributor.title === 'Restfulness') restfulness = Number(contributor.score);
      if (contributor.title === 'Consistency') sleepConsistency = Number(contributor.score);
    }

    biometrics = {
      hr_last_read: Math.trunc(hrValues[hrValues.length - 1]),
      hr_min: Math.trunc(Math.min(...hrValues)),
      hr_max: Math.trunc(Math.max(...hrValues)),
      spo2_min: Math.trunc(Math.min(...spo2Values)),
      spo2_max: Math.trunc(Math.max(...spo2Values)),
      hrv_last_read: Math.trunc(hrvValues[hrvValues.length - 1]),
      hrv_min: Math.trunc(Math.min(...hrvValues)),
      hrv_max: Math.trunc(Math.max(...hrvValues)),
      steps: Math.trunc(Number(steps.total)),
      night_rhr_avg: Number(nightRhr.avg),
      night_rhr_min: Math.trunc(Math.min(...nightRhrValues)),
      night_rhr_max: Math.trunc(Math.max(...nightRhrValues)),
      sleep_hrv_avg: Number(avgSleepHrv.value),
      sleep_score: Number(sleep.sleep_score.score),
      restfulness,
      sleep_consistency: sleepConsistency,
      recovery_index: Number(recovery.value),
      movement_index: Number(movement.value),
      vo2max: Number(vo2max.value),
    };
  } catch (err) {
    return {
      status: 'skipped',
      message: `Incomplete metrics for ${date} (${err instanceof Error ? err.message : String(err)}). The ring may not have synced yet; skipping.`,
    };
  }

  const { data: biometricsRow, error: upsertError } = await supabase
    .from('daily_biometrics')
    .upsert({ user_id: userId, date, updated_at: new Date().toISOString(), ...biometrics }, { onConflict: 'user_id,date' })
    .select('id')
    .single();
  if (upsertError) return { status: 'failure', message: upsertError.message };

  const sleepMetric = metrics.find((m) => m.type === 'sleep');
  if (sleepMetric) {
    const sleepObject = sleepMetric.object;
    const timeInBed = (sleepObject.quick_metrics ?? []).find((m: any) => m.type === 'time_in_bed');

    const stages: Record<string, { time: number; percentage: number }> = {};
    for (const stage of sleepObject.sleep_stages ?? []) {
      stages[stage.type] = { time: Math.trunc(Number(stage.stage_time)), percentage: Number(stage.percentage) };
    }

    const sleepRow = {
      daily_biometrics_id: biometricsRow.id,
      bedtime_start: new Date(sleepObject.bedtime_start * 1000).toISOString(),
      bedtime_end: new Date(sleepObject.bedtime_end * 1000).toISOString(),
      time_in_bed_seconds: Math.trunc(Number(timeInBed?.value ?? 0)),
      total_sleep_seconds: Math.trunc(Number(sleepObject.total_sleep.seconds)),
      efficiency: Number(sleepObject.sleep_efficiency.percentage),
      hr_avg: Number(sleepObject.hr_graph.gist_object.avg),
      hr_min: Math.trunc(Number(sleepObject.hr_graph.gist_object.min)),
      hr_max: Math.trunc(Number(sleepObject.hr_graph.gist_object.max)),
      hrv_avg: Number(sleepObject.hrv_graph.gist_object.avg),
      hrv_min: Math.trunc(Number(sleepObject.hrv_graph.gist_object.min)),
      hrv_max: Math.trunc(Number(sleepObject.hrv_graph.gist_object.max)),
      hr_drop_seconds: Math.trunc(Number(sleepObject.hr_drop?.seconds ?? 0)),
      deep_sleep_time_seconds: stages.deep_sleep?.time ?? 0,
      deep_sleep_percentage: stages.deep_sleep?.percentage ?? 0,
      light_sleep_time_seconds: stages.light_sleep?.time ?? 0,
      light_sleep_percentage: stages.light_sleep?.percentage ?? 0,
      rem_sleep_time_seconds: stages.rem_sleep?.time ?? 0,
      rem_sleep_percentage: stages.rem_sleep?.percentage ?? 0,
      awake_sleep_time_seconds: stages.awake?.time ?? 0,
      awake_sleep_percentage: stages.awake?.percentage ?? 0,
      score_day_avg: Number(sleepObject.score_trend.day_avg),
      score_week_avg: Number(sleepObject.score_trend.week_avg),
      score_month_avg: Number(sleepObject.score_trend.month_avg),
      score_year_avg: Number(sleepObject.score_trend.year_avg),
      completed_sleep_cycles: Math.trunc(Number(sleepObject.full_sleep_cycles.cycles)),
      partial_sleep_cycles: (sleepObject.sleep_cycles?.cycles ?? []).filter((c: any) => c.cycleType === 'partial').length,
      movements: Math.trunc(Number(sleepObject.movements.count)),
      morning_alertness: Number(sleepObject.morning_alertness?.minutes ?? 0),
    };

    const { error: sleepError } = await supabase.from('sleep_sessions').upsert(sleepRow, { onConflict: 'daily_biometrics_id' });
    if (sleepError) return { status: 'failure', message: sleepError.message };
  }

  return { status: 'success', message: `Successfully synced metrics for ${date}` };
}
