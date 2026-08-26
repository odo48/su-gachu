import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { tdee, targets, age, type Sex, type Activity, type Goal } from '@/lib/food/nutrition';
import recipesData from '@/data/recipes.json';

// Recomandarea zilnică. Numerele se calculează DETERMINIST (nutrition.ts);
// modelul doar alege mesele potrivite din recipes.json + argumentează + dă antrenament.
//
// Structured-output extraction is a different capability than the food-agent's
// tool-calling loop (src/lib/ai/*), so this stays provider-specific here rather
// than going through the ModelProvider registry: Gemini uses a response schema,
// Claude uses a forced single tool call — same net effect, different mechanism.

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const responseSchema = {
  type: 'object',
  properties: {
    rationale: { type: 'string' },
    suggested_meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string' },
          name: { type: 'string' },
          slot: { type: 'string' }, // breakfast|lunch|dinner|snack
        },
        required: ['recipe_id', 'name', 'slot'],
      },
    },
    training: {
      type: 'object',
      properties: {
        type: { type: 'string' },        // strength|cardio|rest
        focus: { type: 'string' },         // ex: "piept + triceps"
        cardio_minutes: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['type', 'focus', 'cardio_minutes', 'notes'],
    },
  },
  required: ['rationale', 'suggested_meals', 'training'],
};

type RecommendAi = {
  rationale: string;
  suggested_meals: { recipe_id: string; name: string; slot: string }[];
  training: { type: string; focus: string; cardio_minutes: number; notes: string };
};

async function generateWithGemini(prompt: string): Promise<RecommendAi> {
  const result = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseJsonSchema: responseSchema },
  });
  return JSON.parse(result.text ?? '{}');
}

async function generateWithClaude(prompt: string): Promise<RecommendAi> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    tools: [{ name: 'submit_recommendation', description: 'Submit the daily recommendation.', input_schema: responseSchema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: 'tool', name: 'submit_recommendation' },
    messages: [{ role: 'user', content: prompt }],
  });
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  return toolUse?.input as RecommendAi;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const provider = body?.provider === 'claude' ? 'claude' : 'gemini';

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
    .from('daily_biometrics').select('*')
    .eq('user_id', user.id).eq('date', today)
    .maybeSingle();

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

  // 3. Modelul ales alege mesele + argumentează, using THIS user's profile.goal.
  const goal = profile.goal as Goal;
  const coaching =
    goal === 'fat_loss'
      ? 'Ești un coach pentru deficit caloric. Prioritatea #1: PĂSTRAREA masei musculare. Proteina e sacră, forța rămâne în program.'
      : goal === 'recomposition'
        ? 'Ești un coach pentru recompoziție. Prioritatea #1: proteina și antrenamentul de forță, calorii ușor sub TDEE.'
        : goal === 'muscle_gain'
          ? 'Ești un coach pentru surplus controlat. Prioritatea #1: progresie în forță, surplus modest fără exces de grăsime.'
          : 'Ești un coach pentru menținere. Prioritatea #1: stabilitate, proteina constantă, forța păstrată.';

  const prompt = `${coaching}

Profil: ${profile.weight_kg}kg, ${profile.height_cm}cm, vârstă ${age(profile.birth_date)}, ${profile.sex}, obiectiv ${goal}.
Metrici azi: ${metrics ? JSON.stringify({ steps: metrics.steps, active_kcal: metrics.active_kcal, sleep_min: metrics.sleep_minutes, hrv: metrics.hrv, resting_hr: metrics.resting_hr }) : 'fără date wearable azi'}.
Ținte calculate (respectă-le STRICT, mai ales proteina și plafonul de calorii): ${t.calories} kcal, ${t.protein_g}g proteină, ${t.carbs_g}g carbo, ${t.fat_g}g grăsime.
Estimare onestă pierdere grăsime: ~${t.estWeeklyFatLossKg} kg/săpt (restul scăderii de pe cântar e apă/glicogen).
În rationale: amintește scurt hidratare+electroliți+somn și menționează că forța trebuie păstrată, nu înlocuită cu cardio.

Alege mese DOAR din acest catalog (folosește recipe_id exact) ca să atingi țintele, prioritizând proteina:
${JSON.stringify(catalog)}

Pentru antrenament: dacă HRV e scăzut sau somnul sub 6h → recomandă recuperare/cardio ușor.
Argumentează scurt în limba română.`;

  const modelName = provider === 'claude' ? 'claude-sonnet-4-5' : 'gemini-2.5-flash';
  const ai = provider === 'claude' ? await generateWithClaude(prompt) : await generateWithGemini(prompt);

  // 4. Salvează
  const { data: saved } = await supabase.from('recommendations').insert({
    user_id: user.id, date: today,
    target_calories: t.calories, target_protein_g: t.protein_g,
    target_carbs_g: t.carbs_g, target_fat_g: t.fat_g,
    rationale: ai.rationale, suggested_meals: ai.suggested_meals,
    training: ai.training, model: modelName,
  }).select().single();

  return NextResponse.json({ targets: t, tdee: tdeeVal, ...ai, id: saved?.id });
}
