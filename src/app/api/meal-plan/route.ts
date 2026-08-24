/**
 * GET  /api/meal-plan?week=2025-06-02  → plan săptămânal + opțiuni + shopping
 * POST /api/meal-plan                   → creează / actualizează plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function currentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const weekStart = req.nextUrl.searchParams.get('week') ?? currentMonday();

  const { data: plan } = await supabase
    .from('meal_plans').select('*')
    .eq('user_id', user.id).eq('week_start_date', weekStart).maybeSingle();

  if (!plan) return NextResponse.json({ plan: null, options: [], shopping_items: [] });

  const [{ data: options }, { data: shopping }] = await Promise.all([
    supabase.from('meal_plan_options').select('*').eq('meal_plan_id', plan.id),
    supabase.from('shopping_items').select('*').eq('meal_plan_id', plan.id).order('category'),
  ]);

  return NextResponse.json({ plan, options: options ?? [], shopping_items: shopping ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { week_start_date, week_end_date, notes, options, shopping_items } = await req.json();
  if (!week_start_date || !week_end_date) {
    return NextResponse.json({ error: 'week_start_date and week_end_date required' }, { status: 400 });
  }

  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .upsert({ user_id: user.id, week_start_date, week_end_date, notes },
             { onConflict: 'user_id,week_start_date' })
    .select().single();

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 400 });

  await supabase.from('meal_plan_options').delete().eq('meal_plan_id', plan.id);
  await supabase.from('shopping_items').delete().eq('meal_plan_id', plan.id);

  if (options?.length) {
    await supabase.from('meal_plan_options').insert(
      options.map((o: any) => ({ ...o, meal_plan_id: plan.id }))
    );
  }
  if (shopping_items?.length) {
    await supabase.from('shopping_items').insert(
      shopping_items.map((s: any) => ({ ...s, meal_plan_id: plan.id }))
    );
  }

  return NextResponse.json({ id: plan.id, message: 'Plan salvat.' }, { status: 201 });
}
