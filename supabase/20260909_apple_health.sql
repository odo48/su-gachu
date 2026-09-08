-- ============================================================
-- Created: 2026-09-09
-- Apple Watch integration via a per-user iOS Shortcut push.
--
-- Apple Health has no server API: the user installs a Shortcut on their
-- iPhone that reads the Watch's daily metrics + sleep stages and POSTs them
-- to /api/apple-health/ingest. Auth is a per-user bearer token; only its
-- SHA-256 hash is stored here (high-entropy token, no Vault needed —
-- unlike the Garmin/Ultrahuman secrets in schema_biometrics.sql).
--
-- apple_health_daily_biometrics is the raw per-provider table (same role as
-- garmin_daily_biometrics from 20260826_biometrics_common.sql); the ingest
-- route also translates each day into the common daily_biometrics table via
-- src/lib/biometrics/translate.ts.
--
-- Run in Supabase SQL Editor, after 20260830_gmail_connections.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Raw daily metrics from HealthKit (via the Shortcut).
-- ------------------------------------------------------------
create table if not exists apple_health_daily_biometrics (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  steps            int,
  active_kcal      int,
  exercise_min     int,
  resting_hr       int,
  avg_hr           int,
  min_hr           int,
  max_hr           int,
  hrv              int,
  vo2max           numeric(4,1),
  respiratory_rate numeric(4,1),
  spo2_avg         numeric(4,1),
  weight_kg        numeric(5,1),
  sleep_start      timestamptz,
  sleep_end        timestamptz,
  in_bed_min       int,
  asleep_min       int,
  core_min         int,
  deep_min         int,
  rem_min          int,
  awake_min        int,
  raw              jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, date)
);

alter table apple_health_daily_biometrics enable row level security;

drop policy if exists "own apple health biometrics" on apple_health_daily_biometrics;
create policy "own apple health biometrics" on apple_health_daily_biometrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. Connection + auth state. token_hash is sha256(hex) of the bearer
--    token handed to the Shortcut; the plaintext is shown to the user once
--    at connect time and never stored.
-- ------------------------------------------------------------
create table if not exists apple_health_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  token_hash     text not null unique,
  device_name    text,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table apple_health_connections enable row level security;

-- Owner may read their own connection (never exposes the hash — the API
-- route selects only connected/device_name/last_synced_at). Writes go
-- through the service-role client in /api/apple-health/*, same as the
-- Garmin webhook.
drop policy if exists "own apple health connection read" on apple_health_connections;
create policy "own apple health connection read" on apple_health_connections
  for select using (auth.uid() = user_id);
