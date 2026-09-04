-- ============================================================
-- Created: 2026-08-29
-- Ported from transaction-manager's packages/signals: proactive alerts
-- (subscription renewals, low-balance forecasts, income anomalies, fraud
-- outliers, email-derived refund/trial signals). In-app only — no email
-- delivery, so the source's channel/quiet-hours policy is dropped; only the
-- priority value survives, for UI sort/color. Run after
-- 20260828_transaction_enrichment.sql. Idempotent.
-- ============================================================

do $$
begin
  create type signal_type_t as enum (
    'fraud_anomaly',
    'subscription_renewal',
    'subscription_still_using',
    'low_balance_forecast',
    'refund_pending',
    'trial_ending',
    'income_missing',
    'income_changed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type signal_status_t as enum ('detected', 'confirmed', 'resolved', 'expired', 'dismissed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type signal_priority_t as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end $$;

create table if not exists financial_signals (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,
  type                   signal_type_t not null,
  status                 signal_status_t not null default 'detected',
  source_type            text not null check (source_type in ('email', 'transaction', 'rule')),
  source_id              text,
  expected_value         jsonb,
  expected_by_date       date,
  matched_transaction_id bigint references transactions(id) on delete set null,
  confidence             real,
  priority               signal_priority_t not null default 'medium',
  created_at             timestamptz not null default now(),
  resolved_at            timestamptz
);

alter table financial_signals enable row level security;
drop policy if exists "own financial signals" on financial_signals;
create policy "own financial signals" on financial_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_financial_signals_open
  on financial_signals(user_id, type, source_id)
  where status in ('detected', 'confirmed');

create table if not exists financial_signal_events (
  id          bigint generated always as identity primary key,
  signal_id   bigint not null references financial_signals(id) on delete cascade,
  -- Redundant with financial_signals.user_id on purpose: keeps RLS a plain
  -- equality check instead of an EXISTS subquery into the parent table.
  user_id     uuid not null references auth.users(id) on delete cascade,
  from_status signal_status_t,
  to_status   signal_status_t not null,
  note        text,
  created_at  timestamptz not null default now()
);

alter table financial_signal_events enable row level security;
drop policy if exists "own financial signal events" on financial_signal_events;
create policy "own financial signal events" on financial_signal_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
