-- ============================================================
-- Adds the 'workout' value to app_module_t. Run after schema_workouts.sql.
-- Created: 2026-09-15
--
-- Must run (and commit) as its own statement, separately from
-- 20260915_seed_workout_module.sql — Postgres forbids using a freshly added
-- enum value inside the same transaction that added it ("unsafe use of new
-- value of enum type"). Run this file's "Run" in the SQL Editor first, then
-- run the seed file as a second, separate execution.
-- ============================================================

alter type app_module_t add value if not exists 'workout';
