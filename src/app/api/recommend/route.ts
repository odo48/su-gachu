import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { tdee, targets, age, type Sex, type Activity, type Goal } from '@/lib/nutrition';
import recipesData from '@/data/recipes.json';

// Recomandarea zilnică. Numerele se calculează DETERMINIST (nutrition.ts);
// Gemini doar alege mesele potrivite din recipes.json + argumentează + dă antrenament.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    rationale: { type: SchemaType.STRING },
    suggested_meals: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          recipe_id: { type: SchemaType.STRING },
          name: { type: SchemaType.STRING },
          slot: { type: SchemaType.STRING }, // breakfast|lunch|dinner|snack
        },
        required: ['recipe_id', 'name', 'slot'],
      },
    },
    training: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING },        // strength|cardio|rest
        focus: { type: SchemaType.STRING },         // ex: "piept + triceps"
        cardio_minutes: { type: SchemaType.NUMBER },
        notes: { type: SchemaType.STRING },
      },
      required: ['type', 'focus', 'cardio_minutes', 'notes'],
    },
  },
  required: ['rationale', 'suggested_meals', 'training'],
};

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();
  if (!profile?.birth_date || !profile?.height_cm || !profile?.weight_kg) {
    return NextResponse.json({ error: 'profil incomplet' }, { status: 400 });
  }
  if (profile.medical_flags) {
    return NextResponse.json({ error: 'consult medical necesar' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: metrics } = await supabase
    .from('daily_metrics').select('*')
    .eq('user_id', user.id).eq('date', today)
    .order('source', { ascending: false }).limit(1).maybeSingle();

  // 1. Numere deterministe
  const tdeeVal = tdee({
    weightKg: profile.weight_kg, heightCm: profile.height_cm,
    ageYears: age(profile.birth_date), sex: profile.sex as Sex,
    activity: profile.activity_level as Activity,
    activeKcalToday: metrics?.active_kcal,
  });
  const t = targets(tdeeVal, profile.weight_kg, {
    goal: profile.goal as Goal,
    manualCalorieCap: profile.manual_calorie_cap,   // ex: 1500
    targetWeightKg: profile.target_weight_kg,
  });

  // 2. Catalog scurt de rețete pt LLM (doar id/nume/macros/category)
  const catalog = (recipesData as any).recipes.map((r: any) => ({
    id: r.id, name: r.name, category: r.category,
    kcal: r.nutrition.calories, protein: r.nutrition.protein_g,
    highProtein: r.highProtein, lowCalorie: r.lowCalorie,
  }));

  // 3. Gemini alege + argumentează
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: responseSchema as any },
  });

  const prompt = `Ești un coach pentru un cut agresiv pe termen scurt, asumat de user.
Prioritatea #1: PĂSTRAREA masei musculare în deficit mare. Proteina e sacră, forța rămâne în program.

Profil: ${profile.weight_kg}kg, ${profile.height_cm}cm, vârstă ${age(profile.birth_date)}, ${profile.sex}, obiectiv ${profile.goal}.
Metrici azi: ${metrics ? JSON.stringify({ steps: metrics.steps, active_kcal: metrics.active_kcal, sleep_min: metrics.sleep_minutes, hrv: metrics.hrv, resting_hr: metrics.resting_hr }) : 'fără date wearable azi'}.
Ținte calculate (respectă-le STRICT, mai ales proteina și plafonul de calorii): ${t.calories} kcal, ${t.protein_g}g proteină, ${t.carbs_g}g carbo, ${t.fat_g}g grăsime.
Estimare onestă pierdere grăsime: ~${t.estWeeklyFatLossKg} kg/săpt (restul scăderii de pe cântar e apă/glicogen).
În rationale: amintește scurt hidratare+electroliți+somn și menționează că forța trebuie păstrată, nu înlocuită cu cardio.

Alege mese DOAR din acest catalog (folosește recipe_id exact) ca să atingi țintele, prioritizând proteina:
${JSON.stringify(catalog)}

Pentru antrenament: dacă HRV e scăzut sau somnul sub 6h → recomandă recuperare/cardio ușor.
Argumentează scurt în limba română.`;

  const result = await model.generateContent(prompt);
  const ai = JSON.parse(result.response.text());

  // 4. Salvează
  const { data: saved } = await supabase.from('recommendations').insert({
    user_id: user.id, date: today,
    target_calories: t.calories, target_protein_g: t.protein_g,
    target_carbs_g: t.carbs_g, target_fat_g: t.fat_g,
    rationale: ai.rationale, suggested_meals: ai.suggested_meals,
    training: ai.training, model: 'gemini-2.5-flash',
  }).select().single();

  return NextResponse.json({ targets: t, tdee: tdeeVal, ...ai, id: saved?.id });
}
