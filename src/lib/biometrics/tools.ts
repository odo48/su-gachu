import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';
import { getGarminMetricTrends, getLatestGarminMetrics } from '../garmin/metrics';

// Ultrahuman tools (get_latest_ultrahuman / get_ultrahuman_trends) read
// daily_biometrics. Garmin tools are separate. No sync logic here.

function mapBiometricsRow(row: {
  id: number;
  date: string;
  hr_last_read: number;
  hr_min: number;
  hr_max: number;
  spo2_min: number;
  spo2_max: number;
  hrv_last_read: number;
  hrv_min: number;
  hrv_max: number;
  steps: number;
  night_rhr_avg: number;
  night_rhr_min: number;
  night_rhr_max: number;
  sleep_hrv_avg: number;
  sleep_score: number;
  restfulness: number;
  sleep_consistency: number;
  recovery_index: number;
  movement_index: number;
  vo2max: number;
  created_at: string;
  updated_at: string;
  sleep_sessions?:
    | {
        bedtime_start: string;
        bedtime_end: string;
        time_in_bed_seconds: number;
        total_sleep_seconds: number;
        efficiency: number;
        hr_avg: number;
        hr_min: number;
        hr_max: number;
        hrv_avg: number;
        hrv_min: number;
        hrv_max: number;
        hr_drop_seconds: number;
        deep_sleep_time_seconds: number;
        deep_sleep_percentage: number;
        light_sleep_time_seconds: number;
        light_sleep_percentage: number;
        rem_sleep_time_seconds: number;
        rem_sleep_percentage: number;
        awake_sleep_time_seconds: number;
        awake_sleep_percentage: number;
        score_day_avg: number;
        score_week_avg: number;
        score_month_avg: number;
        score_year_avg: number;
        completed_sleep_cycles: number;
        partial_sleep_cycles: number;
        movements: number;
        morning_alertness: number;
      }[]
    | null;
}) {
  const sleep = row.sleep_sessions?.[0] ?? null;
  return {
    source: 'ultrahuman' as const,
    id: row.id,
    date: row.date,
    hrLastRead: row.hr_last_read,
    hrMin: row.hr_min,
    hrMax: row.hr_max,
    spo2Min: row.spo2_min,
    spo2Max: row.spo2_max,
    hrvLastRead: row.hrv_last_read,
    hrvMin: row.hrv_min,
    hrvMax: row.hrv_max,
    steps: row.steps,
    nightRhrAvg: row.night_rhr_avg,
    nightRhrMin: row.night_rhr_min,
    nightRhrMax: row.night_rhr_max,
    sleepHrvAvg: row.sleep_hrv_avg,
    sleepScore: row.sleep_score,
    restfulness: row.restfulness,
    sleepConsistency: row.sleep_consistency,
    recoveryIndex: row.recovery_index,
    movementIndex: row.movement_index,
    vo2Max: row.vo2max,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sleep: sleep && {
      bedtimeStart: sleep.bedtime_start,
      bedtimeEnd: sleep.bedtime_end,
      timeInBedSeconds: sleep.time_in_bed_seconds,
      totalSleepSeconds: sleep.total_sleep_seconds,
      efficiency: sleep.efficiency,
      hrAvg: sleep.hr_avg,
      hrMin: sleep.hr_min,
      hrMax: sleep.hr_max,
      hrvAvg: sleep.hrv_avg,
      hrvMin: sleep.hrv_min,
      hrvMax: sleep.hrv_max,
      hrDropSeconds: sleep.hr_drop_seconds,
      deepSleepTimeSeconds: sleep.deep_sleep_time_seconds,
      deepSleepPercentage: sleep.deep_sleep_percentage,
      lightSleepTimeSeconds: sleep.light_sleep_time_seconds,
      lightSleepPercentage: sleep.light_sleep_percentage,
      remSleepTimeSeconds: sleep.rem_sleep_time_seconds,
      remSleepPercentage: sleep.rem_sleep_percentage,
      awakeSleepTimeSeconds: sleep.awake_sleep_time_seconds,
      awakeSleepPercentage: sleep.awake_sleep_percentage,
      scoreDayAvg: sleep.score_day_avg,
      scoreWeekAvg: sleep.score_week_avg,
      scoreMonthAvg: sleep.score_month_avg,
      scoreYearAvg: sleep.score_year_avg,
      completedSleepCycles: sleep.completed_sleep_cycles,
      partialSleepCycles: sleep.partial_sleep_cycles,
      movements: sleep.movements,
      morningAlertness: sleep.morning_alertness,
    },
  };
}

export async function getLatestUltrahuman(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('daily_biometrics')
    .select('*, sleep_sessions(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? mapBiometricsRow(data)
    : {
        source: 'ultrahuman' as const,
        message:
          'Nu există date Ultrahuman. Conectează inelul pe Profil și apasă Sincronizează.',
      };
}

export async function getUltrahumanTrends(supabase: SupabaseClient, userId: string, days: number) {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_biometrics')
    .select('*, sleep_sessions(*)')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBiometricsRow);
}

export const ULTRAHUMAN_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_latest_ultrahuman',
    description:
      'Latest Ultrahuman ring data: sleep score, restfulness, consistency, recovery index, night RHR, HRV, SPO2, sleep stages. Not Garmin.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_ultrahuman_trends',
    description: 'Ultrahuman ring sleep/recovery trends for the past X days.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Number of past days to include (default 7)' } },
    },
  },
];

export const GARMIN_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_latest_garmin',
    description:
      'Latest Garmin watch data: sleep duration/stages/score, HR, HRV, steps, body battery, stress, calories, activities. Not Ultrahuman.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_garmin_trends',
    description: 'Garmin watch sleep/HR/activity trends for the past X days.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Number of past days to include (default 7)' } },
    },
  },
];

export function createUltrahumanToolExecutor(supabase: SupabaseClient, userId: string): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'get_latest_ultrahuman':
          return JSON.stringify(await getLatestUltrahuman(supabase, userId));
        case 'get_ultrahuman_trends':
          return JSON.stringify(await getUltrahumanTrends(supabase, userId, Number(args.days ?? 7)));
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}

export function createGarminToolExecutor(supabase: SupabaseClient, userId: string): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'get_latest_garmin': {
          const garmin = await getLatestGarminMetrics(supabase, userId);
          return JSON.stringify(
            garmin ?? {
              source: 'garmin',
              message: 'Nu există date Garmin. Sincronizează din Dashboard (tab Garmin → reîncarcă).',
            }
          );
        }
        case 'get_garmin_trends':
          return JSON.stringify(await getGarminMetricTrends(supabase, userId, Number(args.days ?? 7)));
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
