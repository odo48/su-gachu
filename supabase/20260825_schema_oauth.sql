-- ============================================================
-- Created: 2026-08-25
-- OAuth profile name. Run in Supabase SQL Editor, after schema.sql.
--
-- Google/Apple put the display name in raw_user_meta_data.name (and
-- sometimes full_name). Replaces handle_new_user() from schema.sql so
-- the signup trigger copies whichever is present onto profiles.full_name.
-- Idempotent: safe to re-run.
-- ============================================================

create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end; $$;
