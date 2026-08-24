import { parseGarminActivities, activityDisplayType } from '@/lib/sport';

type MetricRow = {
  date: string;
  source: string;
  steps?: number | null;
  active_kcal?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  sleep_minutes?: number | null;
  hrv?: number | null;
  raw?: Record<string, unknown> | null;
};

/** Context Garmin injectat în chat — modelul nu trebuie să ceară manual datele. */
export function formatGarminContextForChat(rows: MetricRow[]): string {
  if (!rows.length) {
    return `[CONTEXT GARMIN — lipsă]
Nu există metrici Garmin în baza de date. Sugerează utilizatorului să sincronizeze ceasul din Dashboard (tab Garmin → reîncarcă sync), apoi să reîntrebe.`;
  }

  const lines = rows.map(m => {
    const raw = (m.raw ?? {}) as Record<string, unknown>;
    const acts = parseGarminActivities(raw);
    const sleepH = m.sleep_minutes != null
      ? `${(m.sleep_minutes / 60).toFixed(1)}h`
      : 'n/a';
    const parts = [
      `Data: ${m.date} (${m.source})`,
      `Somn: ${sleepH}${raw.sleep_score != null ? `, scor somn ${raw.sleep_score}` : ''}`,
      `HRV: ${m.hrv ?? 'n/a'} ms`,
      `RHR: ${m.resting_hr ?? 'n/a'} bpm`,
      `HR mediu: ${m.avg_hr ?? 'n/a'} bpm`,
      `Pași: ${m.steps ?? 'n/a'}`,
      `Kcal active: ${m.active_kcal ?? 'n/a'}`,
      `Stres mediu: ${raw.stress_avg ?? 'n/a'}`,
      `Body battery: ${raw.body_battery_low ?? '?'}-${raw.body_battery_high ?? '?'}%`,
    ];
    if (acts.length) {
      parts.push(
        'Activități: ' + acts.map(a =>
          `${a.name} (${activityDisplayType(a)}, ${a.duration_min} min${a.avg_hr ? `, HR ${a.avg_hr}` : ''})`,
        ).join('; '),
      );
      const msgs = acts.flatMap(a => [a.aerobic_message, a.anaerobic_message].filter(Boolean));
      if (msgs.length) parts.push('Garmin TE: ' + [...new Set(msgs)].join(' · '));
    }
    return '- ' + parts.join(' | ');
  });

  return `[CONTEXT GARMIN — date deja în sistem, NU cere utilizatorului să le reintroducă]
${lines.join('\n')}
Folosește aceste valori pentru recomandări (recovery, plan mâine, competiție). Poți apela și tool-ul get_daily_metrics pentru detalii suplimentare.`;
}
