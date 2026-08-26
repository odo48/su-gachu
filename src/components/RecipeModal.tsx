'use client';

import { useState } from 'react';
import { ChefHat, ChevronRight, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Ingredient = {
  displayName: string;
  optional?: boolean;
};

type Recipe = {
  id: string;
  name: string;
  category?: string;
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  ingredients: Ingredient[];
  instructions: string[];
  estimatedPrepTimeMinutes?: number;
  difficulty?: string;
  tags?: string[];
  highProtein?: boolean;
  lowCalorie?: boolean;
  splitFriendly?: boolean;
  goal?: string[];
};

type Meal = { recipe_id: string; name: string; slot: string };

const difficultyLabel: Record<string, string> = {
  easy: 'Ușor',
  medium: 'Mediu',
  hard: 'Avansat',
};

const slotLabel: Record<string, string> = {
  breakfast: 'Mic dejun',
  lunch: 'Prânz',
  dinner: 'Cină',
  snack: 'Gustare',
};

function MacroPill({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-4 py-3 ${className}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="mt-0.5 text-xs opacity-70">{label}</span>
    </div>
  );
}

function Modal({ recipe, slot, onClose }: { recipe: Recipe; slot: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 pb-3 pt-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{slotLabel[slot] ?? slot}</Badge>
              {recipe.highProtein && <Badge variant="success">High protein</Badge>}
              {recipe.lowCalorie && <Badge variant="warning">Low calorie</Badge>}
              {recipe.splitFriendly && <Badge variant="outline">Meal prep</Badge>}
            </div>
            <h2 className="text-lg font-bold leading-tight">{recipe.name}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Închide"
            className="size-9 shrink-0"
          >
            <X />
          </Button>
        </div>

        <div className="space-y-6 px-5 py-4">
          <div className="grid grid-cols-4 gap-2">
            <MacroPill
              label="kcal"
              value={String(recipe.nutrition.calories)}
              className="bg-primary text-primary-foreground"
            />
            <MacroPill
              label="proteină"
              value={`${recipe.nutrition.protein_g}g`}
              className="bg-primary/15 text-primary"
            />
            <MacroPill
              label="carbo"
              value={`${recipe.nutrition.carbs_g}g`}
              className="bg-amber-500/15 text-amber-400"
            />
            <MacroPill
              label="grăsimi"
              value={`${recipe.nutrition.fat_g}g`}
              className="bg-rose-500/15 text-rose-400"
            />
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            {recipe.estimatedPrepTimeMinutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {recipe.estimatedPrepTimeMinutes} min
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1.5">
                <ChefHat className="h-4 w-4" />
                {difficultyLabel[recipe.difficulty] ?? recipe.difficulty}
              </span>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ingrediente
            </h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${ing.optional ? 'bg-secondary/40' : 'bg-secondary'}`}
                  />
                  <span className={`text-sm ${ing.optional ? 'italic text-muted-foreground' : 'text-foreground'}`}>
                    {ing.displayName}
                    {ing.optional && ' (opțional)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cum se prepară
            </h3>
            <ol className="space-y-3">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/90">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {recipe.tags?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipe.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MealList({
  meals,
  recipes,
}: {
  meals: { recipe_id: string; name: string; slot: string }[];
  recipes: Recipe[];
}) {
  const [open, setOpen] = useState<{ recipe: Recipe; slot: string } | null>(null);

  function handleClick(meal: Meal) {
    const recipe = recipes.find((r) => r.id === meal.recipe_id);
    if (recipe) setOpen({ recipe, slot: meal.slot });
  }

  return (
    <>
      <ul className="space-y-1.5">
        {meals.map((m, i) => {
          const hasDetail = recipes.some((r) => r.id === m.recipe_id);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleClick(m)}
                disabled={!hasDetail}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors duration-200 ${
                  hasDetail
                    ? 'cursor-pointer bg-muted/60 hover:bg-muted group'
                    : 'cursor-default bg-muted/40'
                }`}
              >
                <span className="text-sm font-medium">{m.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{slotLabel[m.slot] ?? m.slot}</Badge>
                  {hasDetail && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && <Modal recipe={open.recipe} slot={open.slot} onClose={() => setOpen(null)} />}
    </>
  );
}
