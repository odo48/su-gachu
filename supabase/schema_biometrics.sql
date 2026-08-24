-- ============================================================
-- Biometrics/Ultrahuman domain. Run in Supabase SQL Editor, after schema.sql
-- and schema_modules.sql.
--
-- Ported from jarvis-backend's DailyBiometrics/Sleep entities + Mcp/BiometricsTool.
-- jarvis had no explicit "date" column (it range-queried createdAt for a
-- calendar day instead); this adds one plus a unique(user_id, date)
-- constraint, matching the pattern su-gachu's existing Garmin daily_metrics
-- table already uses, and makes the sync idempotent per user/day.
--
-- Like Home Assistant, each user's Ultrahuman API token is per-user (jarvis
-- had one global ULTRAHUMAN_TOKEN) and goes through Supabase Vault rather
-- than a plaintext column — same pattern as schema_home_assistant.sql.
-- ============================================================

create table daily_biometrics (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  hr_last_read      int not null,
  hr_min            int not null,
  hr_max            int not null,
  spo2_min          int not null,
  spo2_max          int not null,
  hrv_last_read     int not null,
  hrv_min           int not null,
  hrv_max           int not null,
  steps             int not null,
  night_rhr_avg     numeric(5,1) not null,
  night_rhr_min     int not null,
  night_rhr_max     int not null,
  sleep_hrv_avg     numeric(5,1) not null,
  sleep_score       numeric(5,1) not null,
  restfulness       numeric(5,1) not null,
  sleep_consistency numeric(5,1) not null,
  recovery_index    numeric(5,1) not null,
  movement_index    numeric(5,1) not null,
  vo2max            numeric(5,1) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, date)
);

-- Named sleep_sessions rather than jarvis's "sleeps" to avoid a reserved-ish
-- word as a table name; same 1:1 relationship to daily_biometrics.
create table sleep_sessions (
  id                       bigint generated always as identity primary key,
  daily_biometrics_id      bigint not null unique references daily_biometrics(id) on delete cascade,
  bedtime_start            timestamptz not null,
  bedtime_end              timestamptz not null,
  time_in_bed_seconds      int not null,
  total_sleep_seconds      int not null,
  efficiency               numeric(5,1) not null,
  hr_avg                   numeric(5,1) not null,
  hr_min                   int not null,
  hr_max                   int not null,
  hrv_avg                  numeric(5,1) not null,
  hrv_min                  int not null,
  hrv_max                  int not null,
  hr_drop_seconds          int not null default 0,
  deep_sleep_time_seconds  int not null,
  deep_sleep_percentage    numeric(5,1) not null,
  light_sleep_time_seconds int not null,
  light_sleep_percentage   numeric(5,1) not null,
  rem_sleep_time_seconds   int not null,
  rem_sleep_percentage     numeric(5,1) not null,
  awake_sleep_time_seconds int not null,
  awake_sleep_percentage   numeric(5,1) not null,
  score_day_avg            numeric(5,1) not null,
  score_week_avg           numeric(5,1) not null,
  score_month_avg          numeric(5,1) not null,
  score_year_avg           numeric(5,1) not null,
  completed_sleep_cycles   int not null,
  partial_sleep_cycles     int not null,
  movements                int not null,
  morning_alertness        numeric(5,1) not null default 0,
  created_at               timestamptz not null default now()
);

create table ultrahuman_connections (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  token_secret_id uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table daily_biometrics    enable row level security;
alter table sleep_sessions      enable row level security;
alter table ultrahuman_connections enable row level security;

create policy "own biometrics" on daily_biometrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sleep sessions" on sleep_sessions
  for all using (
    exists (select 1 from daily_biometrics d where d.id = sleep_sessions.daily_biometrics_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from daily_biometrics d where d.id = sleep_sessions.daily_biometrics_id and d.user_id = auth.uid())
  );

-- Read-only for the owner, same reasoning as home_assistant_connections:
-- writes only through the Vault-backed functions below.
create policy "own ultrahuman connection read" on ultrahuman_connections
  for select using (auth.uid() = user_id);

-- ============================================================
-- Vault-backed token storage (mirrors schema_home_assistant.sql)
-- ============================================================
create or replace function upsert_ultrahuman_connection(p_user_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from ultrahuman_connections where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_token);
  else
    v_secret_id := vault.create_secret(p_token, 'ultrahuman_token_' || p_user_id::text);
  end if;

  insert into ultrahuman_connections (user_id, token_secret_id)
  values (p_user_id, v_secret_id)
  on conflict (user_id) do update set updated_at = now();
end;
$$;

revoke all on function upsert_ultrahuman_connection(uuid, text) from public;
grant execute on function upsert_ultrahuman_connection(uuid, text) to service_role;

create or replace function get_ultrahuman_token(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select vs.decrypted_secret
  from ultrahuman_connections uc
  join vault.decrypted_secrets vs on vs.id = uc.token_secret_id
  where uc.user_id = p_user_id;
$$;

revoke all on function get_ultrahuman_token(uuid) from public;
grant execute on function get_ultrahuman_token(uuid) to service_role;

create or replace function delete_ultrahuman_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from ultrahuman_connections where user_id = p_user_id;
  delete from ultrahuman_connections where user_id = p_user_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function delete_ultrahuman_connection(uuid) from public;
grant execute on function delete_ultrahuman_connection(uuid) to service_role;
