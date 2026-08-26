import type { SupabaseClient } from '@supabase/supabase-js';
import type { ToolExecutor, ToolSchema } from '../ai/types';
import { age, tdee, targets, type Activity, type Goal, type Sex } from './nutrition';

// Tool implementations mirroring jarvis-backend's Mcp/RecipeTool, MealPlanTool,
// ShoppingListTool, MealHistoryTool, UserPreferenceTool. No MCP protocol here —
// these run in-process against Supabase, scoped to the authenticated user.

type IngredientInput = { name: string; quantity: string };

function mapRecipeRow(row: {
  id: number;
  title: string;
  type: string;
  tags: string | null;
  source_type: string;
  source_url: string | null;
  instructions: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recipe_ingredients?: { id: number; name: string; quantity: string }[] | null;
}) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    tags: row.tags,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    instructions: row.instructions,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    ingredients: (row.recipe_ingredients ?? []).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
  };
}

export async function searchLocalRecipes(
  supabase: SupabaseClient,
  userId: string,
  args: { keyword: string; type?: string; tags?: string[] }
) {
  let idQuery = supabase
    .from('recipes')
    .select('id, recipe_ingredients!inner(id)')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .ilike('recipe_ingredients.name', `%${args.keyword}%`);

  if (args.type) idQuery = idQuery.eq('type', args.type);
  for (const tag of args.tags ?? []) idQuery = idQuery.ilike('tags', `%${tag}%`);

  const { data: idRows, error: idError } = await idQuery;
  if (idError) throw new Error(idError.message);

  const ids = [...new Set((idRows ?? []).map((r) => r.id as number))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapRecipeRow);
}

export async function storeRecipe(
  supabase: SupabaseClient,
  userId: string,
  args: {
    title: string;
    type: string;
    sourceType: string;
    sourceUrl?: string;
    instructions: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    tags?: string;
    ingredients?: IngredientInput[];
  }
) {
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: args.title,
      type: args.type,
      source_type: args.sourceType,
      source_url: args.sourceUrl ?? null,
      instructions: args.instructions,
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
      tags: args.tags ?? null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const ingredients = args.ingredients ?? [];
  let insertedIngredients: { id: number; name: string; quantity: string }[] = [];
  if (ingredients.length > 0) {
    for (const ingredient of ingredients) {
      if (!ingredient.name || !ingredient.quantity) {
        throw new Error(`Each ingredient must be an object with "name" and "quantity", got: ${JSON.stringify(ingredient)}`);
      }
    }
    const { data, error: ingError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredients.map((i) => ({ recipe_id: recipe.id, name: i.name, quantity: i.quantity })))
      .select();
    if (ingError) throw new Error(ingError.message);
    insertedIngredients = data ?? [];
  }

  return mapRecipeRow({ ...recipe, recipe_ingredients: insertedIngredients });
}

export async function getMealHistory(supabase: SupabaseClient, userId: string, days: number) {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('meal_plan_options')
    .select('meal_type, created_at, recipes(title), meal_plans!inner(user_id)')
    .eq('meal_plans.user_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row) => {
    const createdAt = new Date(row.created_at as string);
    const recipe = row.recipes as unknown as { title: string } | null;
    return {
      recipeName: recipe?.title ?? '',
      type: row.meal_type,
      lastEatenDate: createdAt.toISOString().slice(0, 10),
      daysAgo: Math.floor((now - createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    };
  });
}

export async function getUserPreferences(supabase: SupabaseClient, userId: string) {
  const { data: prefs, error } = await supabase
    .from('food_preferences')
    .select('*, food_excluded_ingredients(name)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prefs) return null;

  const weightKg = Number(prefs.weight_kg);
  const sex: Sex = prefs.gender?.toLowerCase() === 'female' ? 'female' : 'male';
  const activity = prefs.activity_level as Activity;
  const goal = prefs.objective as Goal;

  const tdeeVal = tdee({
    weightKg,
    heightCm: Number(prefs.height_cm),
    ageYears: age(prefs.birth_date),
    sex,
    activity,
  });
  const t = targets(tdeeVal, weightKg, { goal });

  return {
    id: prefs.id,
    objective: prefs.objective,
    weightKg,
    heightCm: Number(prefs.height_cm),
    gender: prefs.gender,
    activityLevel: prefs.activity_level,
    dailyTargetCalories: t.calories,
    dailyTargetProteinGrams: t.protein_g,
    maxStorageDays: prefs.max_storage_days,
    recipeRepeatIntervalDays: prefs.recipe_repeat_interval_days,
    birthDate: prefs.birth_date,
    excludedIngredients: (prefs.food_excluded_ingredients ?? []).map((e: { name: string }) => e.name),
  };
}

type MealPlanOptionInput = {
  recipeId: number;
  mealType: string;
  daysCoverage: number[];
  substitutionNotes?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export async function storeMealPlan(
  supabase: SupabaseClient,
  userId: string,
  args: { weekStartDate: string; weekEndDate: string; options: MealPlanOptionInput[] }
) {
  const { data: existing, error: findErr } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', args.weekStartDate)
    .eq('week_end_date', args.weekEndDate)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  let mealPlanId: number;
  if (existing) {
    mealPlanId = existing.id;
    const { error: delErr } = await supabase.from('meal_plan_options').delete().eq('meal_plan_id', mealPlanId);
    if (delErr) throw new Error(delErr.message);
  } else {
    const { data: created, error: createErr } = await supabase
      .from('meal_plans')
      .insert({ user_id: userId, week_start_date: args.weekStartDate, week_end_date: args.weekEndDate })
      .select('id')
      .single();
    if (createErr) throw new Error(createErr.message);
    mealPlanId = created.id;
  }

  const insertedOptions = [];
  for (const opt of args.options) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .select('id, title, calories, protein, carbs, fat')
      .eq('id', opt.recipeId)
      .eq('user_id', userId)
      .maybeSingle();
    if (recipeErr) throw new Error(recipeErr.message);
    if (!recipe) throw new Error(`Recipe with ID ${opt.recipeId} not found.`);

    const daysCoverage = [...new Set(opt.daysCoverage)].sort((a, b) => a - b);
    if (daysCoverage.length === 0) {
      throw new Error('"daysCoverage" must be a non-empty array of day numbers (1=Monday ... 7=Sunday).');
    }
    for (const day of daysCoverage) {
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        throw new Error(`Each day in "daysCoverage" must be an integer between 1 (Monday) and 7 (Sunday), got: ${day}`);
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('meal_plan_options')
      .insert({
        meal_plan_id: mealPlanId,
        recipe_id: recipe.id,
        meal_type: opt.mealType,
        days_coverage: daysCoverage,
        substitution_notes: opt.substitutionNotes ?? null,
        calories: opt.calories ?? recipe.calories,
        protein: opt.protein ?? recipe.protein,
        carbs: opt.carbs ?? recipe.carbs,
        fat: opt.fat ?? recipe.fat,
      })
      .select()
      .single();
    if (insertErr) throw new Error(insertErr.message);

    insertedOptions.push({
      id: inserted.id,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      mealType: inserted.meal_type,
      daysCoverage: inserted.days_coverage,
      substitutionNotes: inserted.substitution_notes,
      calories: inserted.calories,
      protein: inserted.protein,
      carbs: inserted.carbs,
      fat: inserted.fat,
    });
  }

  return {
    id: mealPlanId,
    weekStartDate: args.weekStartDate,
    weekEndDate: args.weekEndDate,
    options: insertedOptions,
  };
}

type ShoppingItemInput = { name: string; quantity: string; category: string };

export async function storeShoppingList(
  supabase: SupabaseClient,
  userId: string,
  args: { mealPlanId: number; items: ShoppingItemInput[] }
) {
  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('id', args.mealPlanId)
    .eq('user_id', userId)
    .maybeSingle();
  if (planErr) throw new Error(planErr.message);
  if (!plan) throw new Error(`Meal plan with ID ${args.mealPlanId} not found.`);

  const { error: delErr } = await supabase.from('meal_plan_shopping_items').delete().eq('meal_plan_id', plan.id);
  if (delErr) throw new Error(delErr.message);

  for (const item of args.items) {
    if (!item.name || !item.quantity || !item.category) {
      throw new Error(`Each item must be an object with "name", "quantity", and "category", got: ${JSON.stringify(item)}`);
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('meal_plan_shopping_items')
    .insert(args.items.map((i) => ({ meal_plan_id: plan.id, name: i.name, quantity: i.quantity, category: i.category })))
    .select();
  if (insErr) throw new Error(insErr.message);

  return {
    mealPlanId: plan.id,
    items: (inserted ?? []).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, category: i.category })),
  };
}

// Canonical tool schemas, shared by both providers (Gemini sanitizes, Claude
// uses close to as-is) — matches jarvis's MCP tool input schemas exactly.
export const FOOD_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'search_local_recipes',
    description: 'Searches for recipes in the local database by ingredient keyword, type, and tags.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Name of the base ingredient (e.g., "chicken")' },
        type: { type: 'string', description: 'Type of recipe (e.g., "breakfast", "lunch", "dessert")' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to filter against' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'store_recipe',
    description: 'Creates a new recipe and its ingredients in the local database.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string' },
        sourceType: { type: 'string', description: '"manual" | "url" | "youtube"' },
        sourceUrl: { type: 'string' },
        instructions: { type: 'string' },
        calories: { type: 'integer' },
        protein: { type: 'integer' },
        carbs: { type: 'integer' },
        fat: { type: 'integer' },
        tags: { type: 'string', description: 'Comma-separated list of tags' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, quantity: { type: 'string' } },
            required: ['name', 'quantity'],
          },
        },
      },
      required: ['title', 'type', 'sourceType', 'instructions', 'calories', 'protein', 'carbs', 'fat'],
    },
  },
  {
    name: 'get_meal_history',
    description: 'Returns a history of meals that have been planned in the past X days.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Number of past days to look back' } },
      required: ['days'],
    },
  },
  {
    name: 'get_user_preferences',
    description: 'Returns the user preferences including objective, biometrics, and excluded ingredients.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'store_meal_plan',
    description:
      "Creates or replaces the meal plan for a given week, along with its meal options. If a plan already exists for the same week dates, it is replaced.",
    parameters: {
      type: 'object',
      properties: {
        weekStartDate: { type: 'string', description: 'YYYY-MM-DD' },
        weekEndDate: { type: 'string', description: 'YYYY-MM-DD' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              recipeId: { type: 'integer' },
              mealType: { type: 'string' },
              daysCoverage: {
                type: 'array',
                items: { type: 'integer', minimum: 1, maximum: 7 },
                description: 'Day numbers this option covers (1=Monday ... 7=Sunday)',
              },
              substitutionNotes: { type: 'string' },
              calories: { type: 'integer' },
              protein: { type: 'integer' },
              carbs: { type: 'integer' },
              fat: { type: 'integer' },
            },
            required: ['recipeId', 'mealType', 'daysCoverage'],
          },
        },
      },
      required: ['weekStartDate', 'weekEndDate', 'options'],
    },
  },
  {
    name: 'store_shopping_list',
    description: 'Creates or replaces the shopping list for an existing meal plan.',
    parameters: {
      type: 'object',
      properties: {
        mealPlanId: { type: 'integer' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['name', 'quantity', 'category'],
          },
        },
      },
      required: ['mealPlanId', 'items'],
    },
  },
];

export function createFoodToolExecutor(supabase: SupabaseClient, userId: string): ToolExecutor {
  return async (name, args) => {
    try {
      switch (name) {
        case 'search_local_recipes':
          return JSON.stringify(await searchLocalRecipes(supabase, userId, args as { keyword: string; type?: string; tags?: string[] }));
        case 'store_recipe':
          return JSON.stringify(await storeRecipe(supabase, userId, args as Parameters<typeof storeRecipe>[2]));
        case 'get_meal_history':
          return JSON.stringify(await getMealHistory(supabase, userId, Number(args.days)));
        case 'get_user_preferences':
          return JSON.stringify(await getUserPreferences(supabase, userId));
        case 'store_meal_plan':
          return JSON.stringify(await storeMealPlan(supabase, userId, args as Parameters<typeof storeMealPlan>[2]));
        case 'store_shopping_list':
          return JSON.stringify(await storeShoppingList(supabase, userId, args as Parameters<typeof storeShoppingList>[2]));
        default:
          return `Tool '${name}' not found.`;
      }
    } catch (err) {
      return `Tool '${name}' failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}
