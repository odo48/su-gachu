// Ported from jarvis-backend's UserPreferenceDtoFactory (Mifflin-St Jeor).
// Deliberately kept separate from src/lib/nutrition.ts, which uses a
// different formula for the existing /api/recommend flow — not reconciled
// yet, per the food-agent migration plan.

export type FoodObjective = 'lean_cut' | 'maintenance' | 'bulk';
export type FoodActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

const ACTIVITY_MULTIPLIERS: Record<FoodActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const OBJECTIVE_CALORIE_ADJUSTMENT: Record<FoodObjective, number> = {
  lean_cut: -300,
  maintenance: 0,
  bulk: 300,
};

const OBJECTIVE_PROTEIN_MULTIPLIER: Record<FoodObjective, number> = {
  lean_cut: 2.2,
  maintenance: 2.0,
  bulk: 1.8,
};

function ageFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function computeFoodTargets(params: {
  weightKg: number;
  heightCm: number;
  gender: string;
  birthDate: string;
  activityLevel: FoodActivityLevel;
  objective: FoodObjective;
}): { dailyTargetCalories: number; dailyTargetProteinGrams: number } {
  const age = ageFromBirthDate(params.birthDate);
  const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * age;
  const bmr = params.gender.toLowerCase() === 'female' ? base - 161 : base + 5;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[params.activityLevel];

  return {
    dailyTargetCalories: Math.round(tdee + OBJECTIVE_CALORIE_ADJUSTMENT[params.objective]),
    dailyTargetProteinGrams: Math.round(params.weightKg * OBJECTIVE_PROTEIN_MULTIPLIER[params.objective]),
  };
}
