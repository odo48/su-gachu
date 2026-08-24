/** Activități Garmin — fără mapare locală de tip sport. */

export type GarminActivity = {
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

export function parseGarminActivities(
  raw: Record<string, unknown> | null | undefined,
): GarminActivity[] {
  const list = raw?.activities;
  if (!Array.isArray(list)) return [];

  return list
    .map((a: Record<string, unknown>) => ({
      id: (a.id ?? a.activity_id) as number | undefined,
      name: String(a.name ?? 'Activitate'),
      type_key: String(a.type_key ?? ''),
      type_name: (a.type_name as string) ?? null,
      duration_min: Number(a.duration_min ?? 0),
      calories: (a.calories as number) ?? null,
      avg_hr: (a.avg_hr as number) ?? null,
      max_hr: (a.max_hr as number) ?? null,
      training_effect: (a.training_effect as number) ?? null,
      anaerobic_training_effect: (a.anaerobic_training_effect as number) ?? null,
      aerobic_message: (a.aerobic_message as string) ?? null,
      anaerobic_message: (a.anaerobic_message as string) ?? null,
      training_effect_label: (a.training_effect_label as string) ?? null,
      body_battery_delta: (a.body_battery_delta as number) ?? null,
      recovery_time_hours: (a.recovery_time_hours as number) ?? null,
    }))
    .filter(a => a.name && (a.duration_min > 0 || a.type_key));
}

/** Etichetă afișată: nume activitate + tip Garmin. */
export function activityDisplayType(a: GarminActivity): string {
  if (a.type_name && a.type_name !== a.type_key) return a.type_name;
  if (a.type_key) return a.type_key.replace(/_/g, ' ');
  return 'Activitate';
}

/** Mesaje de recuperare returnate de Garmin (training effect etc.). */
export function garminRecoveryMessages(activities: GarminActivity[]): string[] {
  const out: string[] = [];
  for (const a of activities) {
    if (a.aerobic_message) out.push(a.aerobic_message);
    if (a.anaerobic_message && a.anaerobic_message !== a.aerobic_message) {
      out.push(a.anaerobic_message);
    }
    if (a.training_effect_label) out.push(a.training_effect_label);
    if (a.recovery_time_hours != null && a.recovery_time_hours > 0) {
      out.push(`Timp recuperare estimat Garmin: ~${Math.round(a.recovery_time_hours)}h`);
    }
  }
  return [...new Set(out)];
}

export function formatActivitiesForPrompt(activities: GarminActivity[]): string {
  if (!activities.length) return 'Nicio activitate Garmin înregistrată azi.';

  return activities.map(a => {
    const parts = [
      `"${a.name}"`,
      `tip: ${activityDisplayType(a)} (${a.type_key || 'n/a'})`,
      `${a.duration_min} min`,
    ];
    if (a.calories != null) parts.push(`${a.calories} kcal`);
    if (a.avg_hr != null) parts.push(`HR mediu ${a.avg_hr}`);
    if (a.training_effect != null) parts.push(`training effect ${a.training_effect}`);
    if (a.aerobic_message) parts.push(`Garmin aerobic: ${a.aerobic_message}`);
    if (a.anaerobic_message) parts.push(`Garmin anaerobic: ${a.anaerobic_message}`);
    if (a.body_battery_delta != null) parts.push(`body battery Δ ${a.body_battery_delta}`);
    return `- ${parts.join(' · ')}`;
  }).join('\n');
}
