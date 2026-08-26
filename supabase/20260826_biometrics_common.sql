-- ============================================================
-- Created: 2026-08-26
-- Splits biometrics storage into per-provider raw tables + one common
-- "daily_biometrics" table that the dashboard/recommend engine and the
-- chat agent's merged-view tool read from. Provider raw tables keep the
-- full payload shape each API actually returns; the common table is a
-- translation layer populated by each provider's sync (see
-- src/lib/biometrics/translate.ts), plus manual entries written directly
-- by DailyMetricsForm. Last-synced-wins per field; `sources` records which
-- provider set each one.
--
-- Run in Supabase SQL Editor, after schema.sql, schema_modules.sql, and
-- schema_biometrics.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Rename Ultrahuman's raw tables (frees up "daily_biometrics" for the
--    common table below). Renaming preserves data, indexes, FKs, and RLS
--    policies — Postgres tracks these by OID, not name.
-- ------------------------------------------------------------
alter table daily_biometrics rename to ultrahuman_daily_biometrics;
alter table sleep_sessions rename to ultrahuman_sleep_sessions;

-- ------------------------------------------------------------
-- 2. Garmin raw table — same shape Garmin sync already writes into
--    daily_metrics (source='garmin'), just scoped to its own table
--    instead of sharing one with manual entries.
-- ------------------------------------------------------------
create table garmin_daily_biometrics (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  steps         int,
  active_kcal   int,
  resting_hr    int,
  avg_hr        int,
  sleep_minutes int,
  hrv           int,
  vo2max        numeric(4,1),
  weight_kg     numeric(5,1),
  raw           jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date)
);

alter table garmin_daily_biometrics enable row level security;
create policy "own garmin biometrics" on garmin_daily_biometrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into garmin_daily_biometrics
  (user_id, date, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, vo2max, weight_kg, raw, created_at)
select user_id, date, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, vo2max, weight_kg, raw, created_at
from daily_metrics
where source = 'garmin'
on conflict (user_id, date) do nothing;

-- ------------------------------------------------------------
-- 3. Common table — one row per user/day, translated from whichever
--    provider(s) the user has connected, plus manual entries.
-- ------------------------------------------------------------
create table daily_biometrics (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  weight_kg     numeric(5,1),
  steps         int,
  active_kcal   int,
  resting_hr    int,
  avg_hr        int,
  sleep_minutes int,
  hrv           int,
  vo2max        numeric(4,1),
  sources       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date)
);

alter table daily_biometrics enable row level security;
create policy "own daily biometrics" on daily_biometrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Backfill one row per user/date from daily_metrics. Manual entries are
-- user-authoritative for the fields they can set (weight/steps/active
-- kcal/sleep); resting_hr/avg_hr/hrv/vo2max only ever came from Garmin.
insert into daily_biometrics
  (user_id, date, weight_kg, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, vo2max, sources)
select
  d.user_id,
  d.date,
  coalesce(manual.weight_kg, garmin.weight_kg),
  coalesce(manual.steps, garmin.steps),
  coalesce(manual.active_kcal, garmin.active_kcal),
  garmin.resting_hr,
  garmin.avg_hr,
  coalesce(manual.sleep_minutes, garmin.sleep_minutes),
  garmin.hrv,
  garmin.vo2max,
  '{}'::jsonb
from (select distinct user_id, date from daily_metrics) d
left join daily_metrics manual on manual.user_id = d.user_id and manual.date = d.date and manual.source = 'manual'
left join daily_metrics garmin on garmin.user_id = d.user_id and garmin.date = d.date and garmin.source = 'garmin'
on conflict (user_id, date) do nothing;

-- ------------------------------------------------------------
-- 4. daily_metrics is now superseded by garmin_daily_biometrics (raw) +
--    daily_biometrics (common). Left in place — not dropped — until the
--    app has run against the new tables and this backfill is verified.
--    Once confirmed, drop it manually:
--      drop table daily_metrics;
-- ------------------------------------------------------------
