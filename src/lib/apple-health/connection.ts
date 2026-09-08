import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Apple Watch data reaches us through a per-user iOS Shortcut that POSTs to
// /api/apple-health/ingest with a bearer token. We store only the token's
// SHA-256 hash (see supabase/20260909_apple_health.sql) — the token itself is
// high-entropy and shown to the user once at connect time.

export async function hasAppleHealthConnection(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('apple_health_connections')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export function generateAppleHealthToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAppleHealthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
