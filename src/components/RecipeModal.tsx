'use client';

import { useState } from 'react';

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
  easy: 'Ușor', medium: 'Mediu', hard: 'Avansat',
};

const slotLabel: Record<string, string> = {
  breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustare',
};

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-4 py-3 ${color}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

function Modal({ recipe, slot, onClose }: { recipe: Recipe; slot: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm dark:bg-black/70" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-lg bg-card text-card-foreground rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto border border-border">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-card px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="badge-blue">{slotLabel[slot] ?? slot}</span>
              {recipe.highProtein && <span className="badge-green">💪 High protein</span>}
              {recipe.lowCalorie  && <span className="badge-yellow">🥗 Low calorie</span>}
              {recipe.splitFriendly && <span className="badge-blue">📦 Meal prep</span>}
            </div>
            <h2 className="text-lg font-bold leading-tight">{recipe.name}</h2>
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-muted hover:bg-accent flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">

          {/* Macros */}
          <div className="grid grid-cols-4 gap-2">
            <MacroPill label="kcal"     value={String(recipe.nutrition.calories)}      color="bg-brand-700 text-white" />
            <MacroPill label="proteină" value={`${recipe.nutrition.protein_g}g`}       color="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" />
            <MacroPill label="carbo"    value={`${recipe.nutrition.carbs_g}g`}         color="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" />
            <MacroPill label="grăsimi"  value={`${recipe.nutrition.fat_g}g`}           color="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" />
          </div>

          {/* Quick info */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            {recipe.estimatedPrepTimeMinutes && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                </svg>
                {recipe.estimatedPrepTimeMinutes} min
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                {difficultyLabel[recipe.difficulty] ?? recipe.difficulty}
              </span>
            )}
          </div>

          {/* Ingrediente */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Ingrediente
            </h3>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ing.optional ? 'bg-brand-200' : 'bg-brand-600'}`} />
                  <span className={`text-sm ${ing.optional ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                    {ing.displayName}
                    {ing.optional && ' (opțional)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Instrucțiuni */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Cum se prepară
            </h3>
            <ol className="space-y-3">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground/90 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Tags */}
          {recipe.tags?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipe.tags.map(tag => (
                <span key={tag} className="badge-blue text-xs">{tag}</span>
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
    const recipe = recipes.find(r => r.id === meal.recipe_id);
    if (recipe) setOpen({ recipe, slot: meal.slot });
  }

  return (
    <>
      <ul className="space-y-1.5">
        {meals.map((m, i) => {
          const hasDetail = recipes.some(r => r.id === m.recipe_id);
          return (
            <li key={i}>
              <button
                onClick={() => handleClick(m)}
                disabled={!hasDetail}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors
                  ${hasDetail
                    ? 'bg-muted/60 hover:bg-muted cursor-pointer group'
                    : 'bg-muted/40 cursor-default'
                  }`}
              >
                <span className="text-sm font-medium">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className="badge-blue">{slotLabel[m.slot] ?? m.slot}</span>
                  {hasDetail && (
                    <svg className="w-3.5 h-3.5 text-brand-300 group-hover:text-brand-500 transition-colors"
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <Modal recipe={open.recipe} slot={open.slot} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
