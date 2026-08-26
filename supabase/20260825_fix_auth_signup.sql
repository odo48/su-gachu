-- ============================================================
-- Created: 2026-08-25
-- Fix OAuth signup: "Database error saving new user".
-- Run after schema.sql, 20260825_schema_oauth.sql, and schema_modules.sql.
-- Idempotent: safe to re-run.
--
-- Triggers on auth.users run with search_path = auth, so unqualified
-- inserts into profiles / user_modules fail and Auth rolls back the user.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.seed_default_user_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_modules (user_id, module, enabled) values
    (new.id, 'food', true),
    (new.id, 'home_assistant', false),
    (new.id, 'biometrics', false),
    (new.id, 'financial', false)
  on conflict (user_id, module) do nothing;
  return new;
end;
$$;

grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.seed_default_user_modules() to supabase_auth_admin;
