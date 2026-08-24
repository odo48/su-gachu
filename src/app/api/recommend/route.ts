import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { tdee, targets, age, type Sex, type Activity, type Goal } from '@/lib/nutrition';
import { formatActivitiesForPrompt, parseGarminActivities } from '@/lib/sport';
import recipesData from '@/data/recipes.json';

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
          name:      { type: SchemaType.STRING },
          slot:      { type: SchemaType.STRING }, // breakfast|lunch|dinner|snack
        },
        required: ['recipe_id', 'name', 'slot'],
      },
    },
    training: {
      type: SchemaType.OBJECT,
      properties: {
        type:           { type: SchemaType.STRING },  // strength|cardio|rest
        focus:          { type: SchemaType.STRING },
        cardio_minutes: { type: SchemaType.NUMBER },
        notes:          { type: SchemaType.STRING },
      },
      required: ['type', 'focus', 'cardio_minutes', 'notes'],
    },
  },
  required: ['rationale', 'suggested_meals', 'training'],
};

function avg(vals: (number | null | undefined)[]): number | null {
  const clean = vals.filter((v): v is number => v != null && !isNaN(v));
  return clean.length ? Math.round(clean.reduce((a, b) => a + b, 0) / clean.length) : null;
}

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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── Date ultimele 7 zile ────────────────────────────────────────────────────
  const { data: weekMetrics } = await supabase
    .from('daily_metrics').select('*')
    .eq('user_id', user.id)
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false });

  // Metricile de azi (preferam garmin > manual)
  const todayMetrics = weekMetrics?.find(m => m.date === today) ??
    weekMetrics?.filter(m => m.date === today).sort((a, b) =>
      a.source === 'garmin' ? -1 : 1
    )[0];

  // Pattern săptămânal
  const pattern = {
    avg_sleep_min: avg(weekMetrics?.map(m => m.sleep_minutes)),
    avg_hrv:       avg(weekMetrics?.map(m => m.hrv)),
    avg_steps:     avg(weekMetrics?.map(m => m.steps)),
    avg_resting_hr: avg(weekMetrics?.map(m => m.resting_hr)),
    avg_active_kcal: avg(weekMetrics?.map(m => m.active_kcal)),
    days_with_data: weekMetrics?.length ?? 0,
    // Trend greutate: diferența dintre prima și ultima zi cu greutate
    weight_trend: (() => {
      const withWeight = (weekMetrics ?? [])
        .filter(m => m.weight_kg)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (withWeight.length < 2) return null;
      return +(Number(withWeight.at(-1)!.weight_kg) - Number(withWeight[0].weight_kg)).toFixed(1);
    })(),
  };

  // Mese din ultimele 7 zile (ce a mâncat recent — de evitat repetiția)
  const { data: recentMeals } = await supabase
    .from('meals_log').select('name, date')
    .eq('user_id', user.id)
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false });

  // ── TDEE + Targets ──────────────────────────────────────────────────────────
  const tdeeVal = tdee({
    weightKg:        profile.weight_kg,
    heightCm:        profile.height_cm,
    ageYears:        age(profile.birth_date),
    sex:             profile.sex as Sex,
    activity:        profile.activity_level as Activity,
    activeKcalToday: todayMetrics?.active_kcal,
  });
  const t = targets(tdeeVal, profile.weight_kg, {
    goal:              profile.goal as Goal,
    manualCalorieCap:  profile.manual_calorie_cap,
    targetWeightKg:    profile.target_weight_kg,
  });

  const todayActivities = parseGarminActivities(
    (todayMetrics?.raw ?? {}) as Record<string, unknown>,
  );

  // ── Catalog rețete ──────────────────────────────────────────────────────────
  const catalog = (recipesData as any).recipes.map((r: any) => ({
    id: r.id, name: r.name, category: r.category,
    kcal: r.nutrition.calories, protein: r.nutrition.protein_g,
    highProtein: r.highProtein, lowCalorie: r.lowCalorie,
  }));

  // ── Prompt cu context săptămânal ────────────────────────────────────────────
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: responseSchema as any },
  });

  const sports: string[] = (profile as any).sports ?? ['sala', 'kickbox', 'padel', 'coarda'];
  const sportsLabel = sports.length
    ? sports.join(', ')
    : 'sală, kickbox, padel, coardă';

  const prompt = `Ești un coach pentru un cut agresiv pe termen scurt, asumat de user.
Prioritatea #1: PĂSTRAREA masei musculare în deficit mare. Proteina e sacră, forța rămâne în program.

PROFIL: ${profile.weight_kg}kg, ${profile.height_cm}cm, vârstă ${age(profile.birth_date)}, ${profile.sex}, obiectiv: ${profile.goal}.
SPORTURI PRACTICATE: ${sportsLabel} (3-4x/săptămână). Ține cont de tipul de sport la recomandarea antrenamentului și recuperării.

METRICI AZI: ${todayMetrics
    ? JSON.stringify({
        steps:       todayMetrics.steps,
        active_kcal: todayMetrics.active_kcal,
        sleep_min:   todayMetrics.sleep_minutes,
        hrv:         todayMetrics.hrv,
        resting_hr:  todayMetrics.resting_hr,
        source:      todayMetrics.source,
      })
    : 'fără date wearable azi'}

PATTERN ULTIMELE 7 ZILE (${pattern.days_with_data} zile cu date):
- Somn mediu: ${pattern.avg_sleep_min ? `${Math.round(pattern.avg_sleep_min / 60 * 10) / 10}h` : 'necunoscut'}
- HRV mediu: ${pattern.avg_hrv ?? 'necunoscut'} ms
- Pași medii: ${pattern.avg_steps?.toLocaleString() ?? 'necunoscut'}
- HR repaus mediu: ${pattern.avg_resting_hr ?? 'necunoscut'} bpm
- Kcal active medii: ${pattern.avg_active_kcal ?? 'necunoscut'} kcal
- Trend greutate 7 zile: ${pattern.weight_trend != null ? `${pattern.weight_trend > 0 ? '+' : ''}${pattern.weight_trend} kg` : 'insuficiente date'}

MESE CONSUMATE RECENT (evită să repeți aceleași preparate):
${recentMeals?.length ? recentMeals.slice(0, 15).map(m => `${m.date}: ${m.name}`).join('\n') : 'nicio înregistrare'}

ACTIVITĂȚI GARMIN AZI (tip exact din ceas — nu inventa alte sporturi):
${formatActivitiesForPrompt(todayActivities)}

ȚINTE CALCULATE (respectă STRICT):
${t.calories} kcal | ${t.protein_g}g proteină | ${t.carbs_g}g carbo | ${t.fat_g}g grăsime
Estimare pierdere grăsime: ~${t.estWeeklyFatLossKg} kg/săpt

INSTRUCȚIUNI RATIONALE:
- Comentează trendul din ultimele 7 zile (somn, HRV, greutate)
- Dacă HRV în scădere sau somn cronic sub 6h → avertizează despre suprasolicitare
- Dacă trend greutate e pozitiv (crește) → ajustează mesajul motivațional
- Amintește: hidratare, electroliți (sodium important în deficit), somn
- Forța se păstrează, nu se înlocuiește cu cardio
- Dacă există activități Garmin: în rationale menționează tipul real (type_key/nume) și mesajele Garmin de training effect; recomandă odihnă/apă/suplimente în funcție de intensitatea zilei (TE, HR, durată), NU după categorii inventate

CATALOG REȚETE (folosește DOAR recipe_id din această listă):
${JSON.stringify(catalog)}

ANTRENAMENT: ține cont de activitățile Garmin de azi (dacă există) + HRV/somn; folosește tipul real de sport din Garmin, nu etichete generice.
Răspunde în română.`;

  const result = await model.generateContent(prompt);
  const ai = JSON.parse(result.response.text());

  const { data: saved } = await supabase.from('recommendations').insert({
    user_id: user.id, date: today,
    target_calories:  t.calories,
    target_protein_g: t.protein_g,
    target_carbs_g:   t.carbs_g,
    target_fat_g:     t.fat_g,
    rationale:        ai.rationale,
    suggested_meals:  ai.suggested_meals,
    training:         ai.training,
    model:            'gemini-2.5-flash',
  }).select().single();

  return NextResponse.json({ targets: t, tdee: tdeeVal, ...ai, id: saved?.id });
}
