const SEX = new Set(['male', 'female']);
const ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'very_active']);
const GOAL = new Set(['fat_loss', 'recomposition', 'muscle_gain', 'maintenance']);

function num(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function parseProfileUpdate(formData: FormData) {
  const sex = String(formData.get('sex') ?? '');
  const activity = String(formData.get('activity_level') ?? '');
  const goal = String(formData.get('goal') ?? '');
  const fullName = String(formData.get('full_name') ?? '')
    .trim()
    .slice(0, 120);
  const birth = String(formData.get('birth_date') ?? '');
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null;

  return {
    full_name: fullName,
    sex: SEX.has(sex) ? sex : 'male',
    birth_date: birthDate,
    height_cm: num(formData.get('height_cm'), 50, 250),
    weight_kg: num(formData.get('weight_kg'), 20, 400),
    target_weight_kg: num(formData.get('target_weight_kg'), 20, 400),
    activity_level: ACTIVITY.has(activity) ? activity : 'active',
    goal: GOAL.has(goal) ? goal : 'fat_loss',
    manual_calorie_cap: num(formData.get('manual_calorie_cap'), 800, 6000),
    updated_at: new Date().toISOString(),
  };
}
