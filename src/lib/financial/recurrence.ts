import type { SupabaseClient } from '@supabase/supabase-js';

// Ported from transaction-manager's packages/jobs/src/recurrence.ts. Simple
// grouping heuristic — reuse an existing recurrence_group_id for the same
// user + normalized payee, else mint a new one. Not cadence detection
// (matching billing intervals); that's signals/detectors/subscription.ts,
// built on top of this grouping.
export async function resolveRecurrenceGroupId(
  supabase: SupabaseClient,
  userId: string,
  normalizedPayee: string | null
): Promise<string> {
  if (normalizedPayee) {
    const { data } = await supabase
      .from('transactions')
      .select('recurrence_group_id')
      .eq('user_id', userId)
      .eq('normalized_payee', normalizedPayee)
      .not('recurrence_group_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (data?.recurrence_group_id) return data.recurrence_group_id as string;
  }

  return crypto.randomUUID();
}
