import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasHomeAssistantConnection(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('home_assistant_connections')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
