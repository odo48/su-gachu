-- ============================================================
-- Created: 2026-08-27
-- Replaces category-tree income/expense detection with a flat `kind`
-- column (income | expense | transfer). Run after schema_financial.sql.
-- Idempotent.
-- ============================================================

alter table categories add column if not exists kind text not null default 'expense';

do $$
begin
  alter table categories
    add constraint categories_kind_check check (kind in ('income', 'expense', 'transfer'));
exception
  when duplicate_object then null;
end $$;

-- Seed one internal-transfer category per existing user so the agent and
-- internal-transfers heuristics have a structural (not just text-based)
-- signal to key off immediately.
insert into categories (user_id, name, kind)
select id, 'Transfer intern', 'transfer' from auth.users
on conflict (user_id, name) do update set kind = 'transfer';
