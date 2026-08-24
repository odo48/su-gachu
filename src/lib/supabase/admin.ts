import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase cu service_role — NUMAI server-side, niciodată în browser.
 * Bypassează RLS; folosit de MCP endpoint pentru operații din jarvis-brain.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}
