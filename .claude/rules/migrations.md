# Supabase migrations

`schema.sql` is bootstrap only. Incremental changes: `supabase/YYYYMMDD_short_name.sql`.

- Filename date prefix + header `Created: YYYY-MM-DD`, purpose, run-after.
- Idempotent when possible (`create or replace`, `if not exists`).
- Never edit `schema.sql` for a live project; never re-run it.
- Order: `schema.sql` → dated migrations → `schema_chat.sql` → `schema_food.sql` → `schema_modules.sql` → HA / biometrics / financial.
- RLS + `auth.uid()` on user tables; Vault definer functions granted to `service_role` only.
