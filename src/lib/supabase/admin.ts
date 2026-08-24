import { createClient } from '@supabase/supabase-js';

// Service-role client (bypasses RLS) — server-only, never import from a
// 'use client' component. Needed for SECURITY DEFINER RPCs restricted to
// service_role (e.g. the Vault-backed functions in schema_home_assistant.sql)
// and for cross-user writes like the Garmin webhook.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
