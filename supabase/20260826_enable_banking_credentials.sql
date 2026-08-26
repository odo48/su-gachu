-- ============================================================
-- Created: 2026-08-26
-- Per-user Enable Banking TPP credentials (app id + PEM in Vault).
-- Run after schema.sql. Idempotent.
-- ============================================================

create table if not exists enable_banking_connections (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  app_id          text not null,
  api_url         text not null default 'https://api.enablebanking.com',
  token_secret_id uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table enable_banking_connections enable row level security;

drop policy if exists "own enable banking connection read" on enable_banking_connections;
create policy "own enable banking connection read" on enable_banking_connections
  for select using (auth.uid() = user_id);

create or replace function upsert_enable_banking_connection(
  p_user_id uuid,
  p_app_id text,
  p_secret text,
  p_api_url text default 'https://api.enablebanking.com'
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from enable_banking_connections where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_secret);
  else
    v_secret_id := vault.create_secret(p_secret, 'enable_banking_pem_' || p_user_id::text);
  end if;

  insert into enable_banking_connections (user_id, app_id, api_url, token_secret_id)
  values (p_user_id, p_app_id, coalesce(nullif(p_api_url, ''), 'https://api.enablebanking.com'), v_secret_id)
  on conflict (user_id) do update
    set app_id = excluded.app_id,
        api_url = excluded.api_url,
        updated_at = now();
end;
$$;

revoke all on function upsert_enable_banking_connection(uuid, text, text, text) from public;
grant execute on function upsert_enable_banking_connection(uuid, text, text, text) to service_role;

create or replace function get_enable_banking_secret(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select vs.decrypted_secret
  from enable_banking_connections c
  join vault.decrypted_secrets vs on vs.id = c.token_secret_id
  where c.user_id = p_user_id;
$$;

revoke all on function get_enable_banking_secret(uuid) from public;
grant execute on function get_enable_banking_secret(uuid) to service_role;

create or replace function delete_enable_banking_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from enable_banking_connections where user_id = p_user_id;
  delete from enable_banking_connections where user_id = p_user_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function delete_enable_banking_connection(uuid) from public;
grant execute on function delete_enable_banking_connection(uuid) to service_role;
