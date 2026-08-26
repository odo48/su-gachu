-- ============================================================
-- Created: 2026-08-26
-- Per-user Enable Banking AIS session after bank consent.
-- Run after schema_financial.sql. Idempotent.
-- ============================================================

create table if not exists enable_banking_sessions (
  user_id        uuid not null references auth.users(id) on delete cascade,
  session_id     text not null,
  aspsp_name     text not null,
  aspsp_country  char(2) not null,
  valid_until    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table enable_banking_sessions enable row level security;

drop policy if exists "own enable banking session" on enable_banking_sessions;
create policy "own enable banking session" on enable_banking_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
