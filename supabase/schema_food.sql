-- ============================================================
-- Food-agent domain. Run in Supabase SQL Editor, after schema.sql.
-- Ported from jarvis-backend's Recipe/MealPlan/UserPreference entities.
-- RLS follows the same per-user pattern as schema.sql.
--
-- NOTE: the Mifflin-St-Jeor target calc now lives in one place
--   (src/lib/food/nutrition.ts, moved from src/lib/nutrition.ts). food_objective_t
--   and food_activity_t are kept as their own enum types (separate from profiles'
--   goal_t/activity_t) but use the exact same string values as nutrition.ts's
--   Goal/Activity, so food_preferences.objective/activity_level cast directly
--   to Goal/Activity in src/lib/food/tools.ts with no translation table.
-- ============================================================

create type recipe_status_t as enum ('draft', 'approved');
create type food_objective_t as enum ('fat_loss', 'recomposition', 'muscle_gain', 'maintenance');
create type food_activity_t as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');

-- 1. RECIPES ------------------------------------------------------
create table recipes (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  type         text not null,             -- e.g. "breakfast", "lunch", "dessert"
  source_type  text not null,             -- "manual" | "url" | "youtube"
  source_url   text,
  instructions text not null,
  calories     int not null,
  protein      int not null,
  carbs        int not null,
  fat          int not null,
  tags         text,                      -- free-text, substring-matched per tag on search
  status       recipe_status_t not null default 'draft',
  created_at   timestamptz not null default now()
);

create table recipe_ingredients (
  id         bigint generated always as identity primary key,
  recipe_id  bigint not null references recipes(id) on delete cascade,
  name       text not null,
  quantity   text not null,               -- free-text quantity, matches jarvis
  created_at timestamptz not null default now()
);

-- 2. MEAL PLANS -----------------------------------------------------
create table meal_plans (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date   date not null,
  created_at      timestamptz not null default now(),
  unique (user_id, week_start_date, week_end_date)
);

create table meal_plan_options (
  id                  bigint generated always as identity primary key,
  meal_plan_id        bigint not null references meal_plans(id) on delete cascade,
  recipe_id           bigint not null references recipes(id),
  meal_type           text not null,               -- e.g. "breakfast", "lunch"
  days_coverage       int[] not null,               -- 1=Monday ... 7=Sunday
  substitution_notes  text,
  calories            int not null,
  protein             int not null,
  carbs               int not null,
  fat                 int not null,
  created_at          timestamptz not null default now()
);

create table meal_plan_shopping_items (
  id            bigint generated always as identity primary key,
  meal_plan_id  bigint not null references meal_plans(id) on delete cascade,
  name          text not null,
  quantity      text not null,
  category      text not null              -- free-text label (meat/dairy/vegetables/pantry/...), not an FK
);

-- 3. FOOD PREFERENCES -------------------------------------------------
create table food_preferences (
  id                          bigint generated always as identity primary key,
  user_id                     uuid not null unique references auth.users(id) on delete cascade,
  objective                   food_objective_t not null default 'maintenance',
  weight_kg                   numeric(5,1) not null,
  height_cm                   numeric(5,1) not null,
  gender                      text not null,
  activity_level              food_activity_t not null default 'moderate',
  max_storage_days            int not null default 7,
  recipe_repeat_interval_days int not null default 14,
  birth_date                  date not null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table food_excluded_ingredients (
  id                 bigint generated always as identity primary key,
  food_preference_id bigint not null references food_preferences(id) on delete cascade,
  name               text not null,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table recipes                    enable row level security;
alter table recipe_ingredients         enable row level security;
alter table meal_plans                 enable row level security;
alter table meal_plan_options          enable row level security;
alter table meal_plan_shopping_items   enable row level security;
alter table food_preferences           enable row level security;
alter table food_excluded_ingredients  enable row level security;

create policy "own recipes" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own recipe ingredients" on recipe_ingredients
  for all using (
    exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid())
  );

create policy "own meal plans" on meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own meal plan options" on meal_plan_options
  for all using (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_options.meal_plan_id and mp.user_id = auth.uid())
  ) with check (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_options.meal_plan_id and mp.user_id = auth.uid())
  );

create policy "own shopping items" on meal_plan_shopping_items
  for all using (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_shopping_items.meal_plan_id and mp.user_id = auth.uid())
  ) with check (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_shopping_items.meal_plan_id and mp.user_id = auth.uid())
  );

create policy "own food preferences" on food_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own excluded ingredients" on food_excluded_ingredients
  for all using (
    exists (select 1 from food_preferences fp where fp.id = food_excluded_ingredients.food_preference_id and fp.user_id = auth.uid())
  ) with check (
    exists (select 1 from food_preferences fp where fp.id = food_excluded_ingredients.food_preference_id and fp.user_id = auth.uid())
  );
