-- ============================================================
-- Created: 2026-08-26
-- Per-user Garmin Connect login (email + password via garth-style
-- unofficial Connect API). Run after schema.sql and schema_modules.sql.
-- Idempotent: safe to re-run.
--
-- Password + OAuth session tokens go through Vault, never a plaintext
-- column. Email is stored in the clear so the UI can show who is connected.
-- ============================================================

create table if not exists garmin_connections (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  garmin_user_id  text,
  token_secret_id uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table garmin_connections enable row level security;

drop policy if exists "own garmin connection read" on garmin_connections;
create policy "own garmin connection read" on garmin_connections
  for select using (auth.uid() = user_id);

create or replace function upsert_garmin_connection(
  p_user_id uuid,
  p_email text,
  p_secret text,
  p_garmin_user_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from garmin_connections where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret);
  else
    v_secret_id := vault.create_secret(p_secret, 'garmin_secret_' || p_user_id::text);
  end if;

  insert into garmin_connections (user_id, email, garmin_user_id, token_secret_id)
  values (p_user_id, p_email, p_garmin_user_id, v_secret_id)
  on conflict (user_id) do update
    set email = excluded.email,
        garmin_user_id = coalesce(excluded.garmin_user_id, garmin_connections.garmin_user_id),
        updated_at = now();
end;
$$;

revoke all on function upsert_garmin_connection(uuid, text, text, text) from public;
grant execute on function upsert_garmin_connection(uuid, text, text, text) to service_role;

create or replace function get_garmin_secret(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select vs.decrypted_secret
  from garmin_connections gc
  join vault.decrypted_secrets vs on vs.id = gc.token_secret_id
  where gc.user_id = p_user_id;
$$;

revoke all on function get_garmin_secret(uuid) from public;
grant execute on function get_garmin_secret(uuid) to service_role;

create or replace function delete_garmin_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from garmin_connections where user_id = p_user_id;
  delete from garmin_connections where user_id = p_user_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function delete_garmin_connection(uuid) from public;
grant execute on function delete_garmin_connection(uuid) to service_role;
