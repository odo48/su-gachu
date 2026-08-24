-- ============================================================
-- Su Gachu — schema completă Supabase
-- Rulează tot dintr-o singură trecere în SQL Editor.
-- ============================================================

-- ── Tipuri enum ──────────────────────────────────────────────
create type sex_t      as enum ('male', 'female');
create type activity_t as enum ('sedentary','light','moderate','active','very_active');
create type goal_t     as enum ('fat_loss','recomposition','muscle_gain','maintenance');

-- ── Helper: auto-update updated_at ───────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
-- 1. PROFIL
-- ============================================================
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  sex              sex_t,
  birth_date       date,
  height_cm        numeric(5,1),
  weight_kg        numeric(5,1),
  target_weight_kg numeric(5,1),
  activity_level   activity_t default 'moderate',
  goal             goal_t     default 'recomposition',
  manual_calorie_cap int,          -- cap dur ales de user (ex: 1500); null = auto din TDEE
  medical_flags    text,           -- condiții care blochează recomandările AI
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-creare profil la signup
create function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2. METRICI ZILNICE (Garmin pull sau manual)
-- ============================================================
create table daily_metrics (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  source        text not null default 'manual', -- 'manual' | 'garmin'
  steps         int,
  active_kcal   int,
  resting_hr    int,
  avg_hr        int,
  sleep_minutes int,
  hrv           int,
  vo2max        numeric(4,1),
  weight_kg     numeric(5,1),
  raw           jsonb,   -- payload complet Garmin (body battery, stress, sleep stages etc.)
  created_at    timestamptz default now(),
  unique (user_id, date, source)
);

alter table daily_metrics enable row level security;
create policy "own metrics" on daily_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_daily_metrics_user_date on daily_metrics (user_id, date desc);

-- ============================================================
-- 3. INGREDIENTE EXCLUSE (preferințe dietetice)
-- ============================================================
create table excluded_ingredients (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now(),
  unique (user_id, name)
);

alter table excluded_ingredients enable row level security;
create policy "own excluded" on excluded_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 4. REȚETE (catalog global + draft-uri importate de AI)
-- ============================================================
create table recipes (
  id           bigint generated always as identity primary key,
  title        text not null,
  meal_type    text not null,                    -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  source_type  text not null default 'local',   -- 'local' | 'external' | 'ai_generated'
  source_url   text,
  instructions text,
  calories     int  not null,
  protein_g    int  not null,
  carbs_g      int  not null,
  fat_g        int  not null,
  tags         text[],
  status       text not null default 'active',  -- 'active' | 'draft' | 'archived'
  high_protein boolean generated always as (protein_g >= 25) stored,
  low_calorie  boolean generated always as (calories <= 400) stored,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

alter table recipes enable row level security;
-- Toată lumea poate citi; doar creatorul poate modifica
create policy "read all recipes"   on recipes for select using (true);
create policy "insert own recipes" on recipes for insert with check (auth.uid() = created_by);
create policy "update own recipes" on recipes for update using (auth.uid() = created_by);

create index idx_recipes_meal_type on recipes (meal_type, status);

-- ============================================================
-- 5. INGREDIENTE REȚETĂ
-- ============================================================
create table recipe_ingredients (
  id         bigint generated always as identity primary key,
  recipe_id  bigint not null references recipes(id) on delete cascade,
  name       text not null,
  quantity   text not null,
  created_at timestamptz default now()
);

alter table recipe_ingredients enable row level security;
create policy "read all recipe_ingredients" on recipe_ingredients for select using (true);
create policy "manage own recipe_ingredients" on recipe_ingredients
  for all using (
    exists (select 1 from recipes r where r.id = recipe_id and r.created_by = auth.uid())
  );

-- ============================================================
-- 6. MESE CONSUMATE (log zilnic)
-- ============================================================
create table meals_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  recipe_id  text,            -- ID din recipes.json sau Supabase (ca string)
  name       text,
  calories   int,
  protein_g  numeric(6,1),
  carbs_g    numeric(6,1),
  fat_g      numeric(6,1),
  created_at timestamptz default now()
);

alter table meals_log enable row level security;
create policy "own meals" on meals_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_meals_log_user_date on meals_log (user_id, date desc);

-- ============================================================
-- 7. RECOMANDĂRI GENERATE DE AI (plan zilnic)
-- ============================================================
create table recommendations (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  target_calories  int,
  target_protein_g numeric(6,1),
  target_carbs_g   numeric(6,1),
  target_fat_g     numeric(6,1),
  rationale        text,
  suggested_meals  jsonb,   -- [{recipe_id, name, slot}]
  training         jsonb,   -- {type, focus, cardio_minutes, notes}
  model            text,
  created_at       timestamptz default now()
);

alter table recommendations enable row level security;
create policy "own recs" on recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_recommendations_user_date on recommendations (user_id, date desc);

-- ============================================================
-- 8. PLANURI SĂPTĂMÂNALE DE MESE
-- ============================================================
create table meal_plans (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  week_end_date   date not null,
  notes           text,
  created_at      timestamptz default now(),
  unique (user_id, week_start_date)
);

alter table meal_plans enable row level security;
create policy "own meal_plans" on meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 9. OPȚIUNI DIN PLAN (ce rețetă, ce zile, macros)
-- ============================================================
create table meal_plan_options (
  id                 bigint generated always as identity primary key,
  meal_plan_id       bigint not null references meal_plans(id) on delete cascade,
  recipe_id          bigint references recipes(id),
  recipe_title       text not null,      -- cache pentru rețete externe/draft
  meal_type          text not null,      -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  days_coverage      text not null,      -- ex: 'Luni-Joi'
  substitution_notes text,
  calories           int  not null,
  protein_g          int  not null,
  carbs_g            int  not null,
  fat_g              int  not null,
  created_at         timestamptz default now()
);

alter table meal_plan_options enable row level security;
create policy "own meal_plan_options" on meal_plan_options
  for all using (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

-- ============================================================
-- 10. LISTĂ DE CUMPĂRĂTURI
-- ============================================================
create table shopping_items (
  id           bigint generated always as identity primary key,
  meal_plan_id bigint not null references meal_plans(id) on delete cascade,
  name         text not null,
  quantity     text not null,
  category     text not null,  -- 'meat' | 'dairy' | 'vegetables' | 'pantry' | 'other'
  checked      boolean default false,
  created_at   timestamptz default now()
);

alter table shopping_items enable row level security;
create policy "own shopping_items" on shopping_items
  for all using (
    exists (select 1 from meal_plans mp where mp.id = meal_plan_id and mp.user_id = auth.uid())
  );

-- ============================================================
-- 11. ISTORICUL CONVERSAȚIEI CU AI
-- ============================================================
create table chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null,   -- 'user' | 'assistant'
  content    text not null,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;
create policy "own chat" on chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_chat_messages_user on chat_messages (user_id, created_at desc);

-- ============================================================
-- SCHEMA V3: câmp sports în profiles
-- ============================================================
alter table profiles add column if not exists sports text[];
-- exemple: '{"kickbox","sala","padel","coarda"}'
