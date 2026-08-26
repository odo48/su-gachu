import { GarminConnect } from 'garmin-connect';
import { parseIsoDate } from './dates';
import { activitiesForDate, flattenGarminRaw, type GarminActivityRaw } from './raw';
import type { GarminDayMetrics, GarminOauthTokens, GarminSecret } from './types';

const GC_API = 'https://connectapi.garmin.com';

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

// Garmin often sends 0 (or omits averageHeartRate entirely) when it has no
// daily average. 0 bpm is not a real reading — treat it as missing.
function positiveHr(v: unknown): number | null {
  const n = num(v);
  if (n == null || n <= 0) return null;
  return Math.round(n);
}

function averageFromHeartRateValues(heart: Loose | null): number | null {
  const values = heart?.heartRateValues;
  if (!Array.isArray(values) || values.length === 0) return null;
  let sum = 0;
  let count = 0;
  for (const point of values) {
    const bpm = Array.isArray(point)
      ? num(point[1])
      : num(asRecord(point as unknown)?.heartRate);
    if (bpm != null && bpm > 0) {
      sum += bpm;
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : null;
}

async function settled<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function isMfaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /mfa|two[- ]?factor|2fa|one[- ]?time/i.test(msg);
}

export class GarminMfaNeededError extends Error {
  constructor() {
    super('Garmin cere un cod MFA pentru acest cont.');
    this.name = 'GarminMfaNeededError';
  }
}

export async function loginGarmin(email: string, password: string, existing?: GarminOauthTokens) {
  const client = new GarminConnect({ username: email, password });

  if (existing?.oauth1 && existing?.oauth2) {
    try {
      client.loadToken(existing.oauth1 as never, existing.oauth2 as never);
      await client.getUserProfile();
      return client;
    } catch {
      // session expired — fall through to password login
    }
  }

  try {
    await client.login(email, password);
  } catch (err) {
    if (isMfaError(err)) throw new GarminMfaNeededError();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg || 'Login Garmin eșuat.');
  }

  return client;
}

export function exportGarminTokens(client: GarminConnect): GarminOauthTokens {
  return client.exportToken() as unknown as GarminOauthTokens;
}

export function serializeSecret(password: string, client: GarminConnect): string {
  const secret: GarminSecret = { password, tokens: exportGarminTokens(client) };
  return JSON.stringify(secret);
}

export function parseSecret(raw: string): GarminSecret {
  const parsed = JSON.parse(raw) as GarminSecret;
  if (!parsed?.password || typeof parsed.password !== 'string') {
    throw new Error('Garmin secret invalid.');
  }
  return parsed;
}

type ProfileBits = { displayName: string; garminUserId: string | null; vo2max: number | null };

export async function readProfile(client: GarminConnect): Promise<ProfileBits> {
  const profile = (await client.getUserProfile()) as unknown as Loose;
  return {
    displayName: String(profile.displayName ?? profile.userName ?? ''),
    garminUserId: profile.profileId != null ? String(profile.profileId) : profile.garminGUID != null ? String(profile.garminGUID) : null,
    vo2max: num(profile.vo2Max) ?? num(profile.vo2MaxPreciseValue),
  };
}

export async function fetchRecentActivities(client: GarminConnect): Promise<unknown[]> {
  const list = await settled(client.getActivities(0, 80));
  return Array.isArray(list) ? list : [];
}

export async function fetchDayMetrics(
  client: GarminConnect,
  isoDate: string,
  displayName: string,
  vo2max: number | null,
  recentActivities: unknown[] = []
): Promise<GarminDayMetrics> {
  const day = parseIsoDate(isoDate);

  const [summary, heart, sleep, weight, hrv] = await Promise.all([
    displayName
      ? settled(
          client.get(`${GC_API}/usersummary-service/usersummary/daily/${displayName}`, {
            params: { calendarDate: isoDate },
          })
        )
      : Promise.resolve(null),
    settled(client.getHeartRate(day)),
    settled(client.getSleepData(day)),
    settled(client.getDailyWeightData(day)),
    settled(client.get(`${GC_API}/hrv-service/hrv/${isoDate}`)),
  ]);

  const summaryR = asRecord(summary);
  const heartR = asRecord(heart);
  const sleepR = asRecord(sleep);
  const sleepDto = asRecord(sleepR?.dailySleepDTO);
  const weightR = asRecord(weight);
  const weightAvg = asRecord(weightR?.totalAverage);
  const hrvR = asRecord(hrv);
  const hrvSummary = asRecord(hrvR?.hrvSummary);

  const steps = num(summaryR?.totalSteps) ?? num(heartR?.totalSteps);
  const activeKcal = num(summaryR?.activeKilocalories);
  const restingHr = positiveHr(heartR?.restingHeartRate) ?? positiveHr(summaryR?.restingHeartRate);
  const avgHr =
    positiveHr(summaryR?.averageHeartRate) ??
    positiveHr(heartR?.averageHeartRate) ??
    positiveHr(heartR?.heartRateAverage) ??
    averageFromHeartRateValues(heartR);
  const sleepSeconds = num(sleepDto?.sleepTimeSeconds);
  const weightGrams = num(weightAvg?.weight);
  const hrvValue = num(hrvSummary?.lastNightAvg) ?? num(hrvSummary?.lastNight) ?? num(hrvSummary?.weeklyAvg);

  const dayActivities: GarminActivityRaw[] = activitiesForDate(recentActivities, isoDate);
  const nestedRaw: Record<string, unknown> = {
    summary: summaryR ?? {},
    heartRate: heartR ?? {},
    sleep: sleepR ?? {},
    hrv: hrvR ?? {},
    hrvStatus: hrvSummary?.status ?? null,
  };

  return {
    date: isoDate,
    steps,
    active_kcal: activeKcal,
    resting_hr: restingHr,
    avg_hr: avgHr,
    sleep_minutes: sleepSeconds != null ? Math.round(sleepSeconds / 60) : null,
    hrv: hrvValue != null ? Math.round(hrvValue) : null,
    vo2max,
    weight_kg: weightGrams != null ? Math.round((weightGrams / 1000) * 10) / 10 : null,
    raw: flattenGarminRaw(nestedRaw, dayActivities),
  };
}

export function hasMetricData(m: GarminDayMetrics): boolean {
  const acts = m.raw?.activities;
  const hasActs = Array.isArray(acts) && acts.length > 0;
  return !!(
    hasActs ||
    m.steps ||
    m.active_kcal ||
    m.sleep_minutes ||
    m.avg_hr ||
    m.resting_hr ||
    m.hrv ||
    m.weight_kg ||
    m.raw?.total_kcal
  );
}
