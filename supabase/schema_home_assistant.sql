-- ============================================================
-- Per-user Home Assistant connection. Run in Supabase SQL Editor, after
-- schema.sql and schema_modules.sql. Requires the "supabase_vault" extension
-- (enabled by default on Supabase projects).
--
-- Ported from jarvis-brain's home_assistant MCP server integration
-- (services/mcp_service.py), which used a single global HA_MCP_URL/HA_TOKEN
-- env var pair for one person's Home Assistant instance. Here each user
-- connects their own instance, so the long-lived access token has to live
-- per-row — it goes through Supabase Vault (encrypted at rest) instead of a
-- plaintext column, and is only ever readable via the SECURITY DEFINER
-- functions below, which are restricted to service_role. Regular clients
-- (including the user who owns the row) can see mcp_url but never the token.
-- ============================================================

create table home_assistant_connections (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  mcp_url         text not null,
  token_secret_id uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table home_assistant_connections enable row level security;

-- Read-only for the owner; no insert/update/delete policy on purpose — all
-- writes go through upsert_ha_connection()/delete_ha_connection() below so
-- the token always flows through Vault rather than a client setting
-- token_secret_id directly (which would let it point at someone else's secret).
create policy "own ha connection read" on home_assistant_connections
  for select using (auth.uid() = user_id);

create or replace function upsert_ha_connection(p_user_id uuid, p_mcp_url text, p_token text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from home_assistant_connections where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_token);
  else
    v_secret_id := vault.create_secret(p_token, 'ha_token_' || p_user_id::text);
  end if;

  insert into home_assistant_connections (user_id, mcp_url, token_secret_id)
  values (p_user_id, p_mcp_url, v_secret_id)
  on conflict (user_id) do update set mcp_url = excluded.mcp_url, updated_at = now();
end;
$$;

revoke all on function upsert_ha_connection(uuid, text, text) from public;
grant execute on function upsert_ha_connection(uuid, text, text) to service_role;

create or replace function get_ha_token(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select vs.decrypted_secret
  from home_assistant_connections hc
  join vault.decrypted_secrets vs on vs.id = hc.token_secret_id
  where hc.user_id = p_user_id;
$$;

revoke all on function get_ha_token(uuid) from public;
grant execute on function get_ha_token(uuid) to service_role;

create or replace function delete_ha_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select token_secret_id into v_secret_id from home_assistant_connections where user_id = p_user_id;
  delete from home_assistant_connections where user_id = p_user_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function delete_ha_connection(uuid) from public;
grant execute on function delete_ha_connection(uuid) to service_role;
