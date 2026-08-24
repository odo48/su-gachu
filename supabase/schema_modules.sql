-- ============================================================
-- Per-user module enablement. Run in Supabase SQL Editor, after schema.sql.
--
-- Deliberately NOT a generic feature-flag framework (no rollout percentages,
-- no targeting rules) — just enough for the future top-level router to know
-- which specialist agents to expose per user, and for a settings page to
-- toggle integrations on/off. Every module a user can have is one row here;
-- absence of a row is treated as "not configured yet" by callers, not as
-- disabled (see src/lib/food/agent.ts, src/lib/home-assistant/agent.ts).
-- ============================================================

create type app_module_t as enum ('food', 'home_assistant', 'biometrics', 'financial');

create table user_modules (
  user_id    uuid not null references auth.users(id) on delete cascade,
  module     app_module_t not null,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module)
);

alter table user_modules enable row level security;

create policy "own modules" on user_modules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed defaults for a newly created user: food is already live for everyone,
-- everything else stays off until the user explicitly connects it.
create or replace function seed_default_user_modules() returns trigger language plpgsql security definer as $$
begin
  insert into user_modules (user_id, module, enabled) values
    (new.id, 'food', true),
    (new.id, 'home_assistant', false),
    (new.id, 'biometrics', false),
    (new.id, 'financial', false);
  return new;
end; $$;

create trigger on_auth_user_created_seed_modules
  after insert on auth.users for each row execute function seed_default_user_modules();

-- Backfill existing users (the trigger above only covers future signups).
insert into user_modules (user_id, module, enabled)
select u.id, m.module, (m.module = 'food')
from auth.users u, unnest(enum_range(null::app_module_t)) as m(module)
on conflict (user_id, module) do nothing;
