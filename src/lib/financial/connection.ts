import type { SupabaseClient } from '@supabase/supabase-js';

export async function hasFinancialAccounts(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('accounts').select('id').eq('user_id', userId).limit(1);
  return (data ?? []).length > 0;
}
