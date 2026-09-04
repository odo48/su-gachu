-- ============================================================
-- Created: 2026-08-30
-- Ported from transaction-manager's packages/gmail + packages/email-
-- ingestion: per-user Gmail OAuth (refresh token in Vault, same shape as
-- 20260826_enable_banking_credentials.sql) plus the email metadata/
-- classification tables the ingestion pipeline writes. Run after
-- 20260829_signals.sql. Idempotent.
-- ============================================================

create table if not exists gmail_connections (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  email_address           text not null,
  status                  text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  refresh_token_secret_id uuid not null,
  last_synced_at          timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table gmail_connections enable row level security;
drop policy if exists "own gmail connection read" on gmail_connections;
create policy "own gmail connection read" on gmail_connections
  for select using (auth.uid() = user_id);

create or replace function upsert_gmail_connection(
  p_user_id uuid,
  p_email text,
  p_refresh_token text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select refresh_token_secret_id into v_secret_id from gmail_connections where user_id = p_user_id;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_refresh_token);
  else
    v_secret_id := vault.create_secret(p_refresh_token, 'gmail_refresh_token_' || p_user_id::text);
  end if;

  insert into gmail_connections (user_id, email_address, status, refresh_token_secret_id)
  values (p_user_id, p_email, 'active', v_secret_id)
  on conflict (user_id) do update
    set email_address = excluded.email_address,
        status = 'active',
        refresh_token_secret_id = excluded.refresh_token_secret_id,
        updated_at = now();
end;
$$;

revoke all on function upsert_gmail_connection(uuid, text, text) from public;
grant execute on function upsert_gmail_connection(uuid, text, text) to service_role;

create or replace function get_gmail_refresh_token(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select vs.decrypted_secret
  from gmail_connections c
  join vault.decrypted_secrets vs on vs.id = c.refresh_token_secret_id
  where c.user_id = p_user_id;
$$;

revoke all on function get_gmail_refresh_token(uuid) from public;
grant execute on function get_gmail_refresh_token(uuid) to service_role;

create or replace function delete_gmail_connection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select refresh_token_secret_id into v_secret_id from gmail_connections where user_id = p_user_id;
  delete from gmail_connections where user_id = p_user_id;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;

revoke all on function delete_gmail_connection(uuid) from public;
grant execute on function delete_gmail_connection(uuid) to service_role;

-- Only metadata + a short snippet is retained per message, never the full
-- body — bodies are fetched on demand for the analyze pass and never stored.
create table if not exists gmail_emails (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  subject          text not null,
  from_address     text not null,
  to_address       text,
  snippet          text not null,
  received_at      timestamptz not null,
  screening        text not null default 'pending' check (screening in ('pending', 'selected', 'skipped')),
  screening_reason text,
  analyzed_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

alter table gmail_emails enable row level security;
drop policy if exists "own gmail emails" on gmail_emails;
create policy "own gmail emails" on gmail_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists gmail_email_classifications (
  id               bigint generated always as identity primary key,
  email_id         bigint not null unique references gmail_emails(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  category         text not null check (
    category in ('receipt', 'refund_promise', 'subscription_confirmation', 'trial_ending', 'shipping', 'irrelevant')
  ),
  extracted_fields jsonb,
  confidence       real not null,
  rationale        text,
  created_at       timestamptz not null default now()
);

alter table gmail_email_classifications enable row level security;
drop policy if exists "own gmail email classifications" on gmail_email_classifications;
create policy "own gmail email classifications" on gmail_email_classifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
