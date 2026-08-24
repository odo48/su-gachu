/**
 * GET  /api/recipes?q=pui&meal_type=lunch  → search recipes
 * POST /api/recipes                         → create recipe (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import recipesJson from '@/data/recipes.json';

export async function GET(req: NextRequest) {
  const q         = req.nextUrl.searchParams.get('q') ?? '';
  const meal_type = req.nextUrl.searchParams.get('meal_type') ?? '';
  const limit     = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '20'), 50);

  const supabase = await createClient();

  // Supabase
  let query = supabase.from('recipes').select('*').eq('status', 'active');
  if (meal_type) query = query.eq('meal_type', meal_type);
  if (q)         query = query.ilike('title', `%${q}%`);
  query = query.limit(limit);
  const { data: dbRecipes } = await query;

  // Local JSON seed
  const allLocal = (recipesJson as any).recipes ?? [];
  const local = allLocal.filter((r: any) => {
    const matchType = !meal_type || r.category?.toLowerCase() === meal_type.toLowerCase();
    const matchQ    = !q || r.name?.toLowerCase().includes(q.toLowerCase());
    return matchType && matchQ;
  });

  return NextResponse.json({
    recipes: [...(dbRecipes ?? []), ...local],
    total:   (dbRecipes?.length ?? 0) + local.length,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { ingredients, ...recipeData } = body;

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({ ...recipeData, created_by: user.id, source_type: recipeData.source_type ?? 'ai_generated' })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (ingredients?.length) {
    await supabase.from('recipe_ingredients').insert(
      ingredients.map((i: any) => ({ recipe_id: recipe.id, name: i.name, quantity: i.quantity }))
    );
  }

  return NextResponse.json(recipe, { status: 201 });
}
