import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasUltrahumanConnection(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('ultrahuman_connections')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
