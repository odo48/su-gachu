import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';
import { getGarminMetricTrends, getLatestGarminMetrics } from '../garmin/metrics';

// Ultrahuman tools (get_latest_ultrahuman / get_ultrahuman_trends) read
// ultrahuman_daily_biometrics; Garmin tools read garmin_daily_biometrics;
// the common tools (get_latest_biometrics / get_biometric_trends) read the
// merged daily_biometrics table. No sync logic here.

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
  ultrahuman_sleep_sessions?:
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
  const sleep = row.ultrahuman_sleep_sessions?.[0] ?? null;
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
    .from('ultrahuman_daily_biometrics')
    .select('*, ultrahuman_sleep_sessions(*)')
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
    .from('ultrahuman_daily_biometrics')
    .select('*, ultrahuman_sleep_sessions(*)')
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

// Merged view: the common `daily_biometrics` table, translated from
// whichever provider(s) synced most recently (see ../biometrics/translate.ts),
// plus manual entries. `sources` names which provider last set each field —
// callers should still cite the device per field, not present this as one
// unified reading.

function mapCommonRow(row: {
  date: string;
  weight_kg: number | null;
  steps: number | null;
  active_kcal: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_minutes: number | null;
  hrv: number | null;
  vo2max: number | null;
  sources: Record<string, string> | null;
}) {
  return {
    date: row.date,
    weightKg: row.weight_kg,
    steps: row.steps,
    activeKcal: row.active_kcal,
    restingHr: row.resting_hr,
    avgHr: row.avg_hr,
    sleepMinutes: row.sleep_minutes,
    hrv: row.hrv,
    vo2Max: row.vo2max,
    sources: row.sources ?? {},
  };
}

export async function getLatestBiometrics(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('daily_biometrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCommonRow(data) : { message: 'Nu există încă date biometrice.' };
}

export async function getBiometricTrends(supabase: SupabaseClient, userId: string, days: number) {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_biometrics')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCommonRow);
}

export const COMMON_BIOMETRICS_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_latest_biometrics',
    description:
      'Merged daily overview (weight, steps, active calories, resting/avg HR, sleep minutes, HRV, VO2max) combining whichever wearables the user has connected. Includes a `sources` map naming which device last updated each field. Prefer this for general "how am I doing" questions; use get_latest_garmin/get_latest_ultrahuman instead for device-specific detail (sleep stages, body battery, recovery index, etc).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_biometric_trends',
    description: 'Merged daily trend for the past X days, combining whichever wearables are connected.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Number of past days to include (default 7)' } },
    },
  },
];

export function createCommonBiometricsToolExecutor(supabase: SupabaseClient, userId: string): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'get_latest_biometrics':
          return JSON.stringify(await getLatestBiometrics(supabase, userId));
        case 'get_biometric_trends':
          return JSON.stringify(await getBiometricTrends(supabase, userId, Number(args.days ?? 7)));
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
