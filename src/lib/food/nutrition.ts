// Calcule deterministe — NU le lăsăm pe seama LLM-ului.
// LLM-ul primește aceste numere ca țintă și alege mesele/argumentează.

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'fat_loss' | 'recomposition' | 'muscle_gain' | 'maintenance';

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Deficit/surplus caloric zilnic per obiectiv.
const GOAL_CALORIE_ADJUSTMENT: Record<Goal, number> = {
  fat_loss: -500,
  recomposition: -350,
  muscle_gain: 250,
  maintenance: 0,
};

// Proteină (g/kg) per obiectiv — mai mare la cut, pentru păstrarea masei musculare.
const GOAL_PROTEIN_MULTIPLIER: Record<Goal, number> = {
  fat_loss: 2.2,
  recomposition: 2.0,
  muscle_gain: 1.8,
  maintenance: 2.0,
};

export function age(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

// Mifflin-St Jeor
export function bmr(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

// TDEE: dacă avem active_kcal real din Garmin, îl preferăm peste factorul de activitate.
export function tdee(args: {
  weightKg: number; heightCm: number; ageYears: number; sex: Sex;
  activity: Activity; activeKcalToday?: number | null;
}): number {
  const base = bmr(args.weightKg, args.heightCm, args.ageYears, args.sex);
  if (args.activeKcalToday && args.activeKcalToday > 0) {
    return Math.round(base + args.activeKcalToday); // BMR + arderi reale măsurate
  }
  return Math.round(base * ACTIVITY_FACTOR[args.activity]);
}

export type Targets = {
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  estWeeklyFatLossKg: number;   // estimare onestă (doar grăsime, nu apă)
};

export type TargetOpts = {
  goal: Goal;
  manualCalorieCap?: number | null;  // ex: 1500 — cap DUR ales de user
  targetWeightKg?: number | null;    // pentru calculul proteinei la supraponderali
};

// Proteina pe greutatea de referință, în funcție de obiectiv.
export function proteinTarget(weightKg: number, goal: Goal): number {
  return Math.round(weightKg * GOAL_PROTEIN_MULTIPLIER[goal]);
}

// Deficit moderat by default. manualCalorieCap permite cut agresiv asumat de user.
export function targets(tdeeVal: number, weightKg: number, opts: TargetOpts): Targets {
  // Caloriile: dacă userul a setat un cap dur, îl respectăm (cu floor de siguranță 1200).
  const calories = opts.manualCalorieCap
    ? Math.max(1200, Math.round(opts.manualCalorieCap))
    : Math.max(1200, Math.round(tdeeVal + GOAL_CALORIE_ADJUSTMENT[opts.goal]));

  // La supraponderali, baza pe greutatea actuală ar umfla inutil proteina și ar mânca tot bugetul.
  const refWeight = opts.targetWeightKg && opts.targetWeightKg > 0
    ? opts.targetWeightKg : weightKg;
  let protein_g = proteinTarget(refWeight, opts.goal);
  // Nu lăsa proteina să depășească 45% din calorii (rămâne loc pt carbo/grăsimi).
  protein_g = Math.min(protein_g, Math.floor((calories * 0.45) / 4));

  const fat_g = Math.round((calories * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));

  // Estimare onestă: deficit real / 7700 kcal per kg grăsime.
  const dailyDeficit = Math.max(0, tdeeVal - calories);
  const estWeeklyFatLossKg = Math.round((dailyDeficit * 7 / 7700) * 10) / 10;

  return { calories, protein_g, carbs_g, fat_g, estWeeklyFatLossKg };
}
