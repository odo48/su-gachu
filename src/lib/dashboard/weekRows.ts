import { isoDateLocal } from '@/lib/garmin/dates';

function weekDates(): { iso: string; label: string; shortLabel: string; isToday: boolean }[] {
  const out: { iso: string; label: string; shortLabel: string; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      iso: isoDateLocal(d),
      label: d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' }),
      shortLabel: d.toLocaleDateString('ro-RO', { weekday: 'short' }).replace(/\.$/, ''),
      isToday: i === 0,
    });
  }
  return out;
}

// Merged view from the common daily_biometrics table — whichever
// provider(s) synced each day, plus manual entries. `sources` lists the
// distinct providers that contributed to that day's row.
export type CommonWeekRow = {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  steps: number | null;
  activeKcal: number | null;
  sleepHours: number | null;
  restingHr: number | null;
  avgHr: number | null;
  hrv: number | null;
  sources: string[];
};

type CommonWeekMetric = {
  date: string;
  steps?: number | null;
  active_kcal?: number | null;
  sleep_minutes?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  hrv?: number | null;
  sources?: Record<string, string> | null;
};

/** Daily average if Garmin sent one; otherwise resting HR (what wearables actually store). 0 is treated as missing. */
export function weekPulse(row: { avgHr: number | null; restingHr?: number | null }): number | null {
  if (row.avgHr != null && row.avgHr > 0) return row.avgHr;
  if (row.restingHr != null && row.restingHr > 0) return row.restingHr;
  return null;
}

export function buildCommonWeekRows(metrics: CommonWeekMetric[]): CommonWeekRow[] {
  const byDate = new Map(metrics.map((m) => [m.date, m]));
  return weekDates().map(({ iso, label, shortLabel, isToday }) => {
    const m = byDate.get(iso);
    return {
      date: iso,
      label,
      shortLabel,
      isToday,
      steps: m?.steps ?? null,
      activeKcal: m?.active_kcal ?? null,
      sleepHours: m?.sleep_minutes != null ? m.sleep_minutes / 60 : null,
      restingHr: m?.resting_hr ?? null,
      avgHr: m?.avg_hr ?? null,
      hrv: m?.hrv ?? null,
      sources: m?.sources ? Array.from(new Set(Object.values(m.sources))) : [],
    };
  });
}

// Ultrahuman-specific weekly view — recovery/sleep detail the common table
// doesn't carry (ultrahuman_daily_biometrics has no raw sleep-stage columns
// itself; those live in ultrahuman_sleep_sessions, not needed for this
// summary-level week table).
export type UltrahumanWeekRow = {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  sleepScore: number | null;
  recoveryIndex: number | null;
  restfulness: number | null;
  nightRhrAvg: number | null;
  hrvLastRead: number | null;
  steps: number | null;
};

type UltrahumanWeekMetric = {
  date: string;
  sleep_score?: number | null;
  recovery_index?: number | null;
  restfulness?: number | null;
  night_rhr_avg?: number | null;
  hrv_last_read?: number | null;
  steps?: number | null;
};

export function buildUltrahumanWeekRows(metrics: UltrahumanWeekMetric[]): UltrahumanWeekRow[] {
  const byDate = new Map(metrics.map((m) => [m.date, m]));
  return weekDates().map(({ iso, label, shortLabel, isToday }) => {
    const m = byDate.get(iso);
    return {
      date: iso,
      label,
      shortLabel,
      isToday,
      sleepScore: m?.sleep_score ?? null,
      recoveryIndex: m?.recovery_index ?? null,
      restfulness: m?.restfulness ?? null,
      nightRhrAvg: m?.night_rhr_avg ?? null,
      hrvLastRead: m?.hrv_last_read ?? null,
      steps: m?.steps ?? null,
    };
  });
}
