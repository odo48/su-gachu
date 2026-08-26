type Loose = Record<string, unknown>;

function asRecord(v: unknown): Loose | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export type GarminActivityRaw = {
  id?: number;
  name: string;
  type_key: string;
  type_name?: string | null;
  duration_min: number;
  calories?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  training_effect?: number | null;
  anaerobic_training_effect?: number | null;
  aerobic_message?: string | null;
  anaerobic_message?: string | null;
  training_effect_label?: string | null;
  body_battery_delta?: number | null;
  recovery_time_hours?: number | null;
};

/** Map a Garmin Connect activity object into the 0.0.2 dashboard shape. */
export function mapGarminActivity(a: Loose): GarminActivityRaw | null {
  const type = asRecord(a.activityType);
  const durationSec = num(a.duration) ?? num(a.elapsedDuration) ?? 0;
  const name = str(a.activityName) ?? str(a.name) ?? 'Activitate';
  const typeKey = str(type?.typeKey) ?? str(a.type_key) ?? '';
  if (!name && durationSec <= 0 && !typeKey) return null;

  return {
    id: num(a.activityId ?? a.id) ?? undefined,
    name,
    type_key: typeKey,
    type_name: str(type?.typeKey) ?? str(a.type_name),
    duration_min: Math.round(durationSec / 60),
    calories: num(a.calories),
    avg_hr: num(a.averageHR ?? a.avg_hr),
    max_hr: num(a.maxHR ?? a.max_hr),
    training_effect: num(a.aerobicTrainingEffect ?? a.training_effect),
    anaerobic_training_effect: num(a.anaerobicTrainingEffect ?? a.anaerobic_training_effect),
    aerobic_message: str(a.aerobicTrainingEffectMessage ?? a.aerobic_message),
    anaerobic_message: str(a.anaerobicTrainingEffectMessage ?? a.anaerobic_message),
    training_effect_label: str(a.trainingEffectLabel ?? a.training_effect_label),
    body_battery_delta: num(a.bodyBatteryDifference ?? a.body_battery_delta),
    recovery_time_hours: num(a.recoveryTimeHours ?? a.recovery_time_hours),
  };
}

export function activitiesForDate(list: unknown, isoDate: string): GarminActivityRaw[] {
  if (!Array.isArray(list)) return [];
  const out: GarminActivityRaw[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Loose;
    const start = str(rec.startTimeLocal) ?? str(rec.startTimeGMT) ?? '';
    if (!start.startsWith(isoDate)) continue;
    const mapped = mapGarminActivity(rec);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * Dashboard / week-table fields expected by the 0.0.2 UI.
 * Accepts either a freshly fetched nested Garmin payload or an already-flat `raw` column.
 */
export function flattenGarminRaw(
  raw: Record<string, unknown> | null | undefined,
  activities: GarminActivityRaw[] = []
): Record<string, unknown> {
  if (!raw && !activities.length) return {};

  const r = raw ?? {};
  const summary = asRecord(r.summary) ?? r;
  const heart = asRecord(r.heartRate);
  const sleepRoot = asRecord(r.sleep);
  const sleepDto =
    asRecord(r.dailySleepDTO) ??
    asRecord(sleepRoot?.dailySleepDTO) ??
    asRecord(summary.dailySleepDTO);
  const scores = asRecord(asRecord(sleepDto?.sleepScores)?.overall);
  const hrvRoot = asRecord(r.hrv);
  const hrvSummary = asRecord(hrvRoot?.hrvSummary) ?? asRecord(r.hrvSummary);

  const existingActs = Array.isArray(r.activities)
    ? (r.activities as GarminActivityRaw[])
    : [];
  const acts = activities.length ? activities : existingActs;

  return {
    bmr_kcal: firstNum(summary.bmrKilocalories, r.bmr_kcal),
    total_kcal: firstNum(summary.totalKilocalories, r.total_kcal),
    body_battery_high: firstNum(
      summary.bodyBatteryHighestValue,
      r.body_battery_high,
      r.bodyBattery,
      summary.bodyBatteryMostRecentValue
    ),
    body_battery_low: firstNum(summary.bodyBatteryLowestValue, r.body_battery_low),
    distance_m: firstNum(summary.totalDistanceMeters, r.distance_m),
    intensity_moderate_min: firstNum(summary.moderateIntensityMinutes, r.intensity_moderate_min),
    intensity_vigorous_min: firstNum(summary.vigorousIntensityMinutes, r.intensity_vigorous_min),
    floors: firstNum(summary.floorsAscended, r.floors),
    max_hr: firstNum(summary.maxHeartRate, heart?.maxHeartRate, r.max_hr),
    hrv_status: str(hrvSummary?.status) ?? str(r.hrvStatus) ?? str(r.hrv_status),
    deep_sleep_seconds: firstNum(sleepDto?.deepSleepSeconds, r.deep_sleep_seconds),
    light_sleep_seconds: firstNum(sleepDto?.lightSleepSeconds, r.light_sleep_seconds),
    rem_sleep_seconds: firstNum(sleepDto?.remSleepSeconds, r.rem_sleep_seconds),
    awake_sleep_seconds: firstNum(sleepDto?.awakeSleepSeconds, r.awake_sleep_seconds),
    sleep_score: firstNum(scores?.value, r.sleepScore, r.sleep_score),
    // Garmin durations are seconds; 0.0.2 stored them under *_min keys.
    stress_rest_min: firstNum(summary.restStressDuration, r.stress_rest_min),
    stress_low_min: firstNum(summary.lowStressDuration, r.stress_low_min),
    stress_medium_min: firstNum(summary.mediumStressDuration, r.stress_medium_min),
    stress_high_min: firstNum(summary.highStressDuration, r.stress_high_min),
    stress_avg: firstNum(summary.averageStressLevel, r.stress, r.stress_avg),
    stress_max: firstNum(summary.maxStressLevel, r.stress_max),
    activities: acts,
  };
}
