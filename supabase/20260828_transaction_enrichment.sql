-- ============================================================
-- Created: 2026-08-28
-- Ported from transaction-manager's enrichment pipeline (packages/jobs):
-- signature-grouped LLM categorization, learned merchant rules, and an
-- audit log for on-demand enrich runs. Run after 20260827_categories_kind.sql.
-- Idempotent.
-- ============================================================

alter table transactions add column if not exists normalized_payee text;
alter table transactions add column if not exists is_internal_transfer boolean not null default false;
alter table transactions add column if not exists is_recurring boolean not null default false;
alter table transactions add column if not exists is_essential boolean;
alter table transactions add column if not exists recurrence_group_id uuid;
alter table transactions add column if not exists enrichment_confidence real;
alter table transactions add column if not exists enrichment_rationale text;
alter table transactions add column if not exists enrichment_source text;

do $$
begin
  alter table transactions
    add constraint transactions_enrichment_source_check
    check (enrichment_source in ('rule', 'agent', 'manual'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_transactions_recurrence_group on transactions(user_id, recurrence_group_id)
  where recurrence_group_id is not null;

create table if not exists merchant_rules (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  pattern          text not null,
  match_type       text not null check (match_type in ('exact', 'contains', 'regex')),
  category_id      bigint references categories(id) on delete cascade,
  normalized_payee text,
  created_at       timestamptz not null default now(),
  unique (user_id, pattern, match_type)
);

alter table merchant_rules enable row level security;
drop policy if exists "own merchant rules" on merchant_rules;
create policy "own merchant rules" on merchant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists finance_job_runs (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_type        text not null check (job_type in ('sync', 'enrich', 'signals', 'email_ingest')),
  status          text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  items_processed int,
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

alter table finance_job_runs enable row level security;
drop policy if exists "own finance job runs" on finance_job_runs;
create policy "own finance job runs" on finance_job_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
