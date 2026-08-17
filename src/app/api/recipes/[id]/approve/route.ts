import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mirrors jarvis-backend's ApproveRecipeController (POST /recipes/{id}/approve),
// with an added ownership check (user_id = auth.uid()) that jarvis's
// single-user version didn't need.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) {
    return NextResponse.json({ error: 'Invalid recipe id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: recipe, error } = await supabase
    .from('recipes')
    .update({ status: 'approved' })
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .select('*, recipe_ingredients(*)')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipe) return NextResponse.json({ error: `Recipe ${recipeId} not found.` }, { status: 404 });

  return NextResponse.json({
    id: recipe.id,
    title: recipe.title,
    type: recipe.type,
    tags: recipe.tags,
    sourceType: recipe.source_type,
    sourceUrl: recipe.source_url,
    instructions: recipe.instructions,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    status: recipe.status,
    ingredients: (recipe.recipe_ingredients ?? []).map((i: { id: number; name: string; quantity: string }) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
    })),
  });
}
