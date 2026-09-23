-- ============================================================
-- Seeds the 'workout' module for every user. Run after
-- 20260915_add_workout_module_type.sql has been committed (separate
-- execution — see the note in that file).
-- Created: 2026-09-15
--
-- Workout tracking is a core feature (like `food`), not an optional
-- integration, so it defaults to enabled for everyone, present and future.
-- ============================================================

create or replace function seed_default_user_modules() returns trigger language plpgsql security definer as $$
begin
  insert into user_modules (user_id, module, enabled) values
    (new.id, 'food', true),
    (new.id, 'workout', true),
    (new.id, 'home_assistant', false),
    (new.id, 'biometrics', false),
    (new.id, 'financial', false);
  return new;
end; $$;

insert into user_modules (user_id, module, enabled)
select u.id, 'workout'::app_module_t, true
from auth.users u
on conflict (user_id, module) do nothing;
