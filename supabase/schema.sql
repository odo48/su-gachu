-- ============================================================
-- AI Coach schema. Run in Supabase SQL Editor.
-- RLS pe toate tabelele: fiecare user vede doar datele lui.
-- ============================================================

create type sex_t as enum ('male', 'female');
create type activity_t as enum ('sedentary','light','moderate','active','very_active');
create type goal_t as enum ('fat_loss','recomposition','muscle_gain','maintenance');

-- 1. PROFIL ------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  sex          sex_t,
  birth_date   date,
  height_cm    numeric(5,1),
  weight_kg    numeric(5,1),
  target_weight_kg numeric(5,1),
  activity_level activity_t default 'moderate',
  goal         goal_t default 'recomposition',
  manual_calorie_cap int,            -- cap dur ales de user (ex: 1500); null = auto din TDEE
  medical_flags text,                 -- condiții care opresc recomandările
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2. METRICI ZILNICE (din Garmin sau manual) --------------------
create table daily_metrics (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  source       text not null default 'manual',   -- 'manual' | 'garmin'
  steps        int,
  active_kcal  int,
  resting_hr   int,
  avg_hr       int,
  sleep_minutes int,
  hrv          int,
  vo2max       numeric(4,1),
  weight_kg    numeric(5,1),
  raw          jsonb,                 -- payload brut de la Garmin
  created_at   timestamptz default now(),
  unique (user_id, date, source)
);

-- 3. MESE CONSUMATE ---------------------------------------------
create table meals_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  recipe_id   text,                   -- corelat cu recipes.json
  name        text,
  calories    int,
  protein_g   numeric(6,1),
  carbs_g     numeric(6,1),
  fat_g       numeric(6,1),
  created_at  timestamptz default now()
);

-- 4. RECOMANDĂRI GENERATE DE AI ---------------------------------
create table recommendations (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  target_calories int,
  target_protein_g numeric(6,1),
  target_carbs_g  numeric(6,1),
  target_fat_g    numeric(6,1),
  rationale       text,
  suggested_meals jsonb,              -- [{recipe_id, name, slot}]
  training        jsonb,              -- {type, focus, cardio_minutes, notes}
  model           text,
  created_at      timestamptz default now()
);

-- 5. TOKENS GARMIN (OAuth) --------------------------------------
create table garmin_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  access_token  text,
  token_secret  text,
  garmin_user_id text,
  updated_at    timestamptz default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table profiles        enable row level security;
alter table daily_metrics   enable row level security;
alter table meals_log       enable row level security;
alter table recommendations enable row level security;
alter table garmin_tokens   enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own metrics" on daily_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own meals" on meals_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own recs" on recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own garmin" on garmin_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- auto-create profile la signup
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
