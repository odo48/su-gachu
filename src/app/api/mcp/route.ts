/**
 * MCP JSON-RPC 2.0 endpoint — înlocuiește jarvis-backend (PHP/Symfony).
 * jarvis-brain se conectează la /_mcp (rewrite în next.config) sau /api/mcp direct.
 *
 * Auth: header X-Brain-Token trebuie să coincidă cu MCP_SECRET din env.
 * User context: BRAIN_USER_ID din env (setup personal, single-user).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import recipesJson from '@/data/recipes.json';

const MCP_SECRET = process.env.MCP_SECRET ?? '';
const BRAIN_USER_ID = process.env.BRAIN_USER_ID ?? '';

// ─── Tool Definitions ────────────────────────────────────────────────────────

function mcpToolModule(name: string): string {
  if (/recipe|meal|food/i.test(name) && name !== 'get_daily_metrics') return 'food_management';
  if (/garmin|daily_metrics|get_user_preferences|get_today_recommendation/i.test(name)) {
    return 'biometrics';
  }
  return 'general';
}

const TOOLS = [
  {
    name: 'search_local_recipes',
    description: 'Caută rețete în baza de date locală după tip de masă și cuvinte cheie. Returnează max 10 rezultate.',
    inputSchema: {
      type: 'object',
      properties: {
        meal_type: { type: 'string', description: 'breakfast | lunch | dinner | snack' },
        keyword:   { type: 'string', description: 'Cuvânt cheie (ex: pui, ton, ouă)' },
        max_results: { type: 'number', description: 'Număr maxim de rezultate (default 10)' },
      },
    },
  },
  {
    name: 'get_user_preferences',
    description: 'Returnează profilul utilizatorului, obiectivul de fitness, macronutrienții țintă și lista de ingrediente excluse.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_meal_history',
    description: 'Returnează istoricul meselor consumate în ultimele N zile.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Număr de zile în urmă (default 14)' },
      },
    },
  },
  {
    name: 'get_daily_metrics',
    description:
      'Metrici Garmin deja sincronizate în DB: somn, HRV, RHR, pași, kcal, activități sport (nume + type_key), body battery, stres. Apelează IMEDIAT la întrebări despre oboseală, recovery, plan antrenament, competiție — NU cere utilizatorului să copieze manual din Garmin Connect.',
    inputSchema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date:   { type: 'string', description: 'YYYY-MM-DD (default: azi)' },
      },
    },
  },
  {
    name: 'get_today_recommendation',
    description: 'Returnează planul de nutriție și antrenament generat de AI pentru ziua curentă.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'store_recipe',
    description: 'Salvează o rețetă nouă (importată extern sau generată de AI) cu status draft.',
    inputSchema: {
      type: 'object',
      properties: {
        title:        { type: 'string' },
        meal_type:    { type: 'string', description: 'breakfast | lunch | dinner | snack' },
        source_url:   { type: 'string' },
        instructions: { type: 'string' },
        calories:     { type: 'number' },
        protein_g:    { type: 'number' },
        carbs_g:      { type: 'number' },
        fat_g:        { type: 'number' },
        tags:         { type: 'array', items: { type: 'string' } },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:     { type: 'string' },
              quantity: { type: 'string' },
            },
            required: ['name', 'quantity'],
          },
        },
      },
      required: ['title', 'meal_type', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
    },
  },
  {
    name: 'save_weekly_meal_plan',
    description: 'Salvează un plan săptămânal de mese aprobat de utilizator, cu opțiunile per masă și lista de cumpărături.',
    inputSchema: {
      type: 'object',
      properties: {
        week_start_date: { type: 'string', description: 'YYYY-MM-DD (luni)' },
        week_end_date:   { type: 'string', description: 'YYYY-MM-DD (duminică)' },
        notes:           { type: 'string' },
        options: {
          type: 'array',
          description: 'Opțiunile de mese din plan',
          items: {
            type: 'object',
            properties: {
              recipe_id:          { type: 'number', description: 'ID rețetă din Supabase (null dacă externă)' },
              recipe_title:       { type: 'string' },
              meal_type:          { type: 'string' },
              days_coverage:      { type: 'string', description: 'Ex: "Luni-Joi" sau "Vineri-Duminică"' },
              substitution_notes: { type: 'string' },
              calories:           { type: 'number' },
              protein_g:          { type: 'number' },
              carbs_g:            { type: 'number' },
              fat_g:              { type: 'number' },
            },
            required: ['recipe_title', 'meal_type', 'days_coverage', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
        shopping_items: {
          type: 'array',
          description: 'Lista de cumpărături grupată pe categorii',
          items: {
            type: 'object',
            properties: {
              name:     { type: 'string' },
              quantity: { type: 'string' },
              category: { type: 'string', description: 'meat | dairy | vegetables | pantry | other' },
            },
            required: ['name', 'quantity', 'category'],
          },
        },
      },
      required: ['week_start_date', 'week_end_date', 'options'],
    },
  },
  {
    name: 'get_weekly_meal_plan',
    description: 'Returnează planul săptămânal curent sau pentru o săptămână specificată.',
    inputSchema: {
      type: 'object',
      properties: {
        week_start_date: { type: 'string', description: 'YYYY-MM-DD. Dacă lipsește, returnează planul săptămânii curente.' },
      },
    },
  },
  {
    name: 'log_meal',
    description: 'Înregistrează o masă consumată azi.',
    inputSchema: {
      type: 'object',
      properties: {
        name:      { type: 'string' },
        recipe_id: { type: 'string', description: 'ID din recipes.json sau Supabase (opțional)' },
        calories:  { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g:   { type: 'number' },
        fat_g:     { type: 'number' },
      },
      required: ['name', 'calories', 'protein_g'],
    },
  },
  {
    name: 'store_garmin_metrics',
    description: 'Salvează metricile zilnice trase din Garmin Connect în Supabase.',
    inputSchema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'object',
          description: 'Obiect cu date Garmin: date, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, vo2max, weight_kg, raw',
        },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'get_training_context',
    description: 'Returnează istoricul antrenamentelor recente (ultimele 14 zile) și metricile de recuperare de azi (HRV, somn, stres). Folosit pentru a decide ce grupă musculară e rândul azi și dacă recuperarea permite antrenament intens.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Zile în urmă (default 14)' },
      },
    },
  },
  {
    name: 'save_training_session',
    description: 'Salvează sesiunea de antrenament de azi: grupa musculară, exerciții cu seturi/repetări/greutate.',
    inputSchema: {
      type: 'object',
      properties: {
        date:         { type: 'string', description: 'YYYY-MM-DD (default azi)' },
        muscle_group: { type: 'string', description: 'push | pull | legs | upper | lower | full_body | cardio' },
        duration_min: { type: 'number' },
        notes:        { type: 'string' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:      { type: 'string' },
              sets:      { type: 'number' },
              reps:      { type: 'string', description: 'ex: "8-10" sau "12"' },
              weight_kg: { type: 'number', description: 'greutate per set (opțional)' },
              notes:     { type: 'string' },
            },
            required: ['name', 'sets', 'reps'],
          },
        },
      },
      required: ['muscle_group'],
    },
  },
];

// ─── Tool Executors ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = createAdminClient();
  if (!userId) return { error: 'User ID lipsă (X-User-Id sau BRAIN_USER_ID)' };

  switch (name) {
    case 'search_local_recipes': {
      const { meal_type, keyword, max_results = 10 } = args as {
        meal_type?: string; keyword?: string; max_results?: number;
      };

      // 1. Caută în Supabase
      let q = db.from('recipes').select('*').eq('status', 'active');
      if (meal_type) q = q.eq('meal_type', meal_type);
      if (keyword)   q = q.ilike('title', `%${keyword}%`);
      q = q.limit(max_results as number);
      const { data: dbRecipes } = await q;

      // 2. Caută în recipes.json (seed local)
      const allLocal = (recipesJson as any).recipes ?? [];
      const jsonRecipes = allLocal.filter((r: any) => {
        const matchType = !meal_type || r.category?.toLowerCase() === meal_type.toLowerCase();
        const matchKw   = !keyword  || r.name?.toLowerCase().includes((keyword as string).toLowerCase());
        return matchType && matchKw;
      }).slice(0, max_results as number);

      return {
        supabase_recipes: dbRecipes ?? [],
        local_recipes: jsonRecipes,
        total: (dbRecipes?.length ?? 0) + jsonRecipes.length,
      };
    }

    case 'get_user_preferences': {
      const { data: profile } = await db
        .from('profiles').select('*').eq('id', userId).single();
      const { data: excluded } = await db
        .from('excluded_ingredients').select('name').eq('user_id', userId);
      return {
        profile,
        sports: (profile as any)?.sports ?? [],
        excluded_ingredients: (excluded ?? []).map((e: any) => e.name),
      };
    }

    case 'get_meal_history': {
      const days = (args.days as number) ?? 14;
      const from = new Date();
      from.setDate(from.getDate() - days);
      const { data } = await db
        .from('meals_log').select('*')
        .eq('user_id', userId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date', { ascending: false });
      return { meals: data ?? [], days_back: days };
    }

    case 'get_daily_metrics': {
      const today = new Date().toISOString().slice(0, 10);
      const { from_date = today, to_date = today } = args as { from_date?: string; to_date?: string };
      const { data } = await db
        .from('daily_metrics').select('*')
        .eq('user_id', userId)
        .eq('source', 'garmin')
        .gte('date', from_date)
        .lte('date', to_date)
        .order('date', { ascending: false });
      return {
        source: 'garmin_sync_supabase',
        from_date,
        to_date,
        metrics: data ?? [],
      };
    }

    case 'get_today_recommendation': {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await db
        .from('recommendations').select('*')
        .eq('user_id', userId).eq('date', today)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data ?? { message: 'Nicio recomandare pentru azi. Generează una din dashboard.' };
    }

    case 'store_recipe': {
      const { ingredients, ...recipeData } = args as any;
      const { data: recipe, error } = await db.from('recipes').insert({
        ...recipeData,
        source_type: 'external',
        status: 'draft',
        created_by: userId,
      }).select().single();
      if (error) return { error: error.message };

      if (ingredients?.length) {
        await db.from('recipe_ingredients').insert(
          ingredients.map((i: any) => ({ recipe_id: recipe.id, name: i.name, quantity: i.quantity }))
        );
      }
      return { id: recipe.id, status: 'draft', message: 'Rețetă salvată ca draft.' };
    }

    case 'save_weekly_meal_plan': {
      const { week_start_date, week_end_date, notes, options, shopping_items } = args as any;

      // Upsert plan (poate exista deja pentru săptămâna asta)
      const { data: plan, error: planErr } = await db
        .from('meal_plans')
        .upsert({ user_id: userId, week_start_date, week_end_date, notes },
                 { onConflict: 'user_id,week_start_date' })
        .select().single();
      if (planErr) return { error: planErr.message };

      // Șterge opțiunile vechi și re-inserează
      await db.from('meal_plan_options').delete().eq('meal_plan_id', plan.id);
      await db.from('shopping_items').delete().eq('meal_plan_id', plan.id);

      if (options?.length) {
        await db.from('meal_plan_options').insert(
          options.map((o: any) => ({ ...o, meal_plan_id: plan.id }))
        );
      }
      if (shopping_items?.length) {
        await db.from('shopping_items').insert(
          shopping_items.map((s: any) => ({ ...s, meal_plan_id: plan.id }))
        );
      }
      return { id: plan.id, message: 'Plan săptămânal salvat.' };
    }

    case 'get_weekly_meal_plan': {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      const weekStart = (args.week_start_date as string) ?? monday.toISOString().slice(0, 10);

      const { data: plan } = await db
        .from('meal_plans').select('*')
        .eq('user_id', userId).eq('week_start_date', weekStart).maybeSingle();
      if (!plan) return { message: 'Niciun plan pentru această săptămână.' };

      const { data: options } = await db
        .from('meal_plan_options').select('*').eq('meal_plan_id', plan.id);
      const { data: shopping } = await db
        .from('shopping_items').select('*').eq('meal_plan_id', plan.id);

      return { plan, options: options ?? [], shopping_items: shopping ?? [] };
    }

    case 'log_meal': {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await db.from('meals_log').insert({ user_id: userId, date: today, ...args });
      if (error) return { error: error.message };
      return { message: 'Masă înregistrată.' };
    }

    case 'store_garmin_metrics': {
      const { metrics } = args as { metrics: Record<string, unknown> };
      if (!metrics?.date) return { error: 'metrics.date lipsă' };

      const payload: Record<string, unknown> = {
        user_id:       userId,
        date:          metrics.date,
        source:        'garmin',
        steps:         metrics.steps        ?? null,
        active_kcal:   metrics.active_kcal  ?? null,
        resting_hr:    metrics.resting_hr   ?? null,
        avg_hr:        metrics.avg_hr       ?? null,
        sleep_minutes: metrics.sleep_minutes ?? null,
        hrv:           metrics.hrv          ?? null,
        vo2max:        metrics.vo2max       ?? null,
        weight_kg:     metrics.weight_kg    ?? null,
        raw:           metrics.raw          ?? null,
      };

      const { error } = await db
        .from('daily_metrics')
        .upsert(payload, { onConflict: 'user_id,date,source' });

      if (error) return { error: error.message };

      // Dacă avem greutate nouă, actualizăm și profilul
      if (metrics.weight_kg) {
        await db.from('profiles')
          .update({ weight_kg: metrics.weight_kg })
          .eq('id', userId);
      }

      return { message: `Metrici Garmin salvate pentru ${metrics.date}.` };
    }

    case 'get_training_context': {
      const days = (args.days as number) ?? 14;
      const from = new Date();
      from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().slice(0, 10);
      const today   = new Date().toISOString().slice(0, 10);

      // Trage metricile Garmin cu activități din ultimele N zile
      const { data: metrics } = await db
        .from('daily_metrics').select('date, hrv, sleep_minutes, resting_hr, raw')
        .eq('user_id', userId).eq('source', 'garmin')
        .gte('date', fromStr)
        .order('date', { ascending: false });

      // Extrage activitățile din raw.activities pentru fiecare zi
      const trainingDays = (metrics ?? []).map((m: any) => {
        const activities: any[] = m.raw?.activities ?? [];
        const workouts = activities.filter((a: any) =>
          a.type_key && !['walking', 'running_generic', 'cycling', 'swimming'].includes(a.type_key)
        );
        return {
          date: m.date,
          hrv: m.hrv,
          sleep_h: m.sleep_minutes ? Math.round(m.sleep_minutes / 60 * 10) / 10 : null,
          resting_hr: m.resting_hr,
          workouts: workouts.map((a: any) => ({
            name:          a.name,
            type:          a.type_key,
            duration_min:  a.duration_min,
            calories:      a.calories,
            avg_hr:        a.avg_hr,
            max_hr:        a.max_hr,
            training_effect: a.training_effect,
            aerobic_message: a.aerobic_message,
            recovery_time_h: a.recovery_time_hours,
            // Exerciții detaliate (forță)
            exercises: (a.exercises ?? []).map((ex: any) => ({
              name: ex.name,
              sets: ex.sets?.length ?? 0,
              detail: ex.sets?.map((s: any) =>
                `${s.reps} reps${s.weight_kg ? ` × ${s.weight_kg}kg` : ''}`
              ),
            })),
          })),
        };
      }).filter((d: any) => d.workouts.length > 0);

      // Recovery de azi
      const todayMetrics = (metrics ?? []).find((m: any) => m.date === today);

      return {
        training_history:    trainingDays,
        today_recovery: {
          hrv:        todayMetrics?.hrv ?? null,
          sleep_h:    todayMetrics?.sleep_minutes
                        ? Math.round(todayMetrics.sleep_minutes / 60 * 10) / 10
                        : null,
          resting_hr: todayMetrics?.resting_hr ?? null,
        },
        days_checked: days,
      };
    }

    case 'save_training_session': {
      const today = new Date().toISOString().slice(0, 10);
      const { date = today, muscle_group, duration_min, notes, exercises } = args as any;

      const { error } = await db.from('training_sessions').insert({
        user_id:      userId,
        date,
        muscle_group,
        duration_min: duration_min ?? null,
        notes:        notes ?? null,
        exercises:    exercises ?? null,
      });

      if (error) return { error: error.message };
      return { message: `Sesiune ${muscle_group} salvată pentru ${date}.` };
    }

    default:
      return { error: `Tool necunoscut: ${name}` };
  }
}

// ─── JSON-RPC Handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  if (MCP_SECRET) {
    const token = req.headers.get('x-brain-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
    if (token !== MCP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
  }

  const { jsonrpc, method, params, id } = body;

  // Notificări (fără id) — răspundem 200 fără body
  if (!id && method?.startsWith('notifications/')) {
    return new NextResponse(null, { status: 200 });
  }

  const ok = (result: unknown) =>
    NextResponse.json({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string) =>
    NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'su-gachu-mcp', version: '2.0' },
      });

    case 'tools/list':
      return ok({
        tools: TOOLS.map(t => ({
          ...t,
          _meta: { module: mcpToolModule(t.name) },
        })),
      });

    case 'tools/call': {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
      if (!toolName) return err(-32602, 'Missing tool name');
      try {
        const mcpUserId =
          req.headers.get('x-user-id') ??
          req.headers.get('X-User-Id') ??
          BRAIN_USER_ID;
        const result = await executeTool(toolName, toolArgs, mcpUserId);
        return ok({ content: [{ type: 'text', text: JSON.stringify(result) }] });
      } catch (e: any) {
        return err(-32000, e?.message ?? 'Tool execution failed');
      }
    }

    default:
      return err(-32601, `Method not found: ${method}`);
  }
}
