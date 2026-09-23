-- ============================================================
-- Workout-tracker domain. Run in Supabase SQL Editor, after schema_modules.sql.
--
-- Exercise catalog (`exercises`) is app-owned, not per-user: seeded once by
-- `scripts/import-exercise-db.mjs` from the public-domain "Free Exercise DB"
-- (yuhonas/free-exercise-db, Unlicense). RLS just grants read to any
-- authenticated user; writes go through the service role only (the import
-- script), so there is no insert/update/delete policy for regular users.
--
-- Routines/workouts/sets are per-user and follow the same RLS pattern as
-- schema_food.sql (auth.uid() = user_id, cascading exists() checks for
-- child tables).
--
-- Photos live in the `exercise-images` Storage bucket (public read), not in
-- the git repo or Next.js `public/` — the source dataset is ~90MB of images
-- and committing that would bloat the repo forever. `exercises.images`
-- stores the storage object paths.
-- ============================================================

create extension if not exists pg_trgm;

-- 1. EXERCISE CATALOG ---------------------------------------------
create table exercises (
  id                text primary key,        -- free-exercise-db slug, e.g. "3_4_Sit-Up"
  name              text not null,
  force             text,                    -- push | pull | static | null (incomplete upstream)
  level             text not null,           -- beginner | intermediate | expert
  mechanic          text,                    -- compound | isolation | null
  equipment         text,
  category          text not null,           -- strength | cardio | stretching | plyometrics | ...
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions      text[] not null default '{}',
  images            text[] not null default '{}',  -- object paths in the exercise-images bucket
  created_at        timestamptz not null default now()
);

create index exercises_name_trgm_idx on exercises using gin (name gin_trgm_ops);
create index exercises_primary_muscles_idx on exercises using gin (primary_muscles);
create index exercises_secondary_muscles_idx on exercises using gin (secondary_muscles);
create index exercises_equipment_idx on exercises (equipment);
create index exercises_category_idx on exercises (category);

alter table exercises enable row level security;

create policy "exercises readable by authenticated users" on exercises
  for select to authenticated using (true);

-- Public bucket: photos are served from /storage/v1/object/public/... without
-- needing a storage.objects RLS policy. Writes only via service_role.
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

-- 2. ROUTINES -------------------------------------------------------
create table workout_routines (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table routine_exercises (
  id               bigint generated always as identity primary key,
  routine_id       bigint not null references workout_routines(id) on delete cascade,
  exercise_id      text not null references exercises(id),
  position         int not null default 0,
  target_sets      int not null default 3,
  target_reps_min  int,
  target_reps_max  int,
  target_weight_kg numeric(6,2),
  rest_seconds     int not null default 90,
  notes            text
);

create index routine_exercises_routine_idx on routine_exercises (routine_id, position);

-- 3. WORKOUT SESSIONS -------------------------------------------------
create table workouts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  routine_id bigint references workout_routines(id) on delete set null,
  name       text not null default 'Antrenament',
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  notes      text,
  created_at timestamptz not null default now()
);

create index workouts_user_started_idx on workouts (user_id, started_at desc);
-- Only one in-progress workout per user at a time.
create unique index workouts_one_active_per_user on workouts (user_id) where ended_at is null;

create table workout_exercises (
  id          bigint generated always as identity primary key,
  workout_id  bigint not null references workouts(id) on delete cascade,
  exercise_id text not null references exercises(id),
  position    int not null default 0,
  notes       text
);

create index workout_exercises_workout_idx on workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on workout_exercises (exercise_id);

create table workout_sets (
  id                  bigint generated always as identity primary key,
  workout_exercise_id bigint not null references workout_exercises(id) on delete cascade,
  set_number          int not null,
  reps                int,
  weight_kg           numeric(6,2),
  rpe                 numeric(3,1),
  is_warmup           boolean not null default false,
  rest_seconds_actual int,
  completed_at        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index workout_sets_workout_exercise_idx on workout_sets (workout_exercise_id, set_number);

-- ============================================================
-- RLS
-- ============================================================
alter table workout_routines  enable row level security;
alter table routine_exercises enable row level security;
alter table workouts          enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets      enable row level security;

create policy "own routines" on workout_routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own routine exercises" on routine_exercises
  for all using (
    exists (select 1 from workout_routines r where r.id = routine_exercises.routine_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_routines r where r.id = routine_exercises.routine_id and r.user_id = auth.uid())
  );

create policy "own workouts" on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own workout exercises" on workout_exercises
  for all using (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
  );

create policy "own workout sets" on workout_sets
  for all using (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  );
