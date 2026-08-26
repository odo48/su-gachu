import type { SupabaseClient } from '@supabase/supabase-js';

// Per-request identity for Gemini/Claude system prompts. Never bake another
// tenant's name, accounts, or home layout into a shared prompt constant.

export async function loadTenantDisplayName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const first = data?.full_name?.trim().split(/\s+/)[0];
  return first || 'the authenticated user';
}

export function tenantIsolationBlock(displayName: string): string {
  return `### TENANT ISOLATION
You are assisting only ${displayName}. Prefer tools over assumptions for personal data (preferences, meals, accounts, biometrics, home devices). Never assume you are talking to a different person, and never reuse names, account numbers, or household details from prior conversations or training examples.`;
}
