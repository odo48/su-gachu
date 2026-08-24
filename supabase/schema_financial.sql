-- ============================================================
-- Financial domain. Run in Supabase SQL Editor, after schema.sql and
-- schema_modules.sql.
--
-- Ported from jarvis-backend's Account/Transaction/Category entities +
-- Mcp/BalanceTool, TransactionTool, ClassifyTransactionTool, CategoryTool.
-- jarvis's Category table was global (single-tenant, no owner at all); here
-- every table is user-scoped, including categories — otherwise one user's
-- custom categories (created autonomously by the agent, see
-- financial_management prompt) would leak into every other user's list.
--
-- NOTE: this ports jarvis's *sync* of already-linked accounts, not an actual
-- Enable Banking consent/account-linking flow — jarvis never had one either
-- (its Account rows were created out-of-band after a manual PSD2 consent).
-- Real account linking (redirect to the bank, handle the callback, create
-- the Account row from the returned account_id) is still a gap, not
-- something this migration regressed.
-- ============================================================

create table categories (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table accounts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  account_id text not null,        -- external ID from Enable Banking
  bank       text not null,
  currency   char(3) not null,
  balance    numeric(20,2) not null default 0,
  iban       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, account_id)
);

create table transactions (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,
  account_id             bigint not null references accounts(id) on delete cascade,
  category_id            bigint references categories(id) on delete set null,
  external_reference     text not null,
  amount                 numeric(20,2) not null,
  currency               char(3) not null,
  creditor_name          text,
  debtor_name            text,
  bank_transaction_code  text,
  credit_debit_indicator varchar(10) not null,
  status                 text not null,
  booking_date           date not null,
  value_date             date,
  remittance_information text,
  tags                   text,
  notes                  text,
  created_at             timestamptz not null default now(),
  unique (account_id, external_reference)
);

create index idx_transactions_booking_date on transactions(user_id, booking_date desc);

-- ============================================================
-- RLS
-- ============================================================
alter table categories   enable row level security;
alter table accounts     enable row level security;
alter table transactions enable row level security;

create policy "own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own accounts" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
