import type { SupabaseClient } from '@supabase/supabase-js';

// Ported from transaction-manager's packages/signals/src/lifecycle.ts: the
// one place a signal's status changes, always paired with a
// financial_signal_events audit row so no caller can transition a signal
// without leaving a trail.
type SignalStatus = 'detected' | 'confirmed' | 'resolved' | 'expired' | 'dismissed';

const TERMINAL_STATUSES: ReadonlySet<SignalStatus> = new Set(['resolved', 'expired', 'dismissed']);

export async function transitionSignal(
  supabase: SupabaseClient,
  userId: string,
  signalId: number,
  toStatus: SignalStatus,
  note?: string
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from('financial_signals')
    .select('status')
    .eq('id', signalId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const { error: updateError } = await supabase
    .from('financial_signals')
    .update({ status: toStatus, resolved_at: TERMINAL_STATUSES.has(toStatus) ? new Date().toISOString() : null })
    .eq('id', signalId)
    .eq('user_id', userId);
  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabase.from('financial_signal_events').insert({
    signal_id: signalId,
    user_id: userId,
    from_status: current?.status ?? null,
    to_status: toStatus,
    note: note ?? null,
  });
  if (eventError) throw new Error(eventError.message);
}
