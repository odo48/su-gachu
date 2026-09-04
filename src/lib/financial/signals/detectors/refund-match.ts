import type { SupabaseClient } from '@supabase/supabase-js';
import { transitionSignal } from '../lifecycle';

const OPEN_STATUSES = ['detected', 'confirmed'];
const AMOUNT_TOLERANCE = 0.01;

// Ported from transaction-manager's packages/signals/src/detectors/
// refund-match.ts. Resolves outstanding refund_pending signals (created by
// Gmail ingestion — see lib/financial/email/signals-from-email.ts — once
// that lands) against an incoming credit transaction of the same amount.
// A no-op stub until then: openRefundSignals is empty with no email
// ingestion producing them yet, so this is safe to run from evaluate.ts
// today and starts working the moment Phase 3 ships.
export async function detectRefundMatches(supabase: SupabaseClient, userId: string, transactionIds: number[]): Promise<number[]> {
  if (transactionIds.length === 0) return [];

  const { data: openRefundSignals, error: signalsError } = await supabase
    .from('financial_signals')
    .select('id, expected_value')
    .eq('user_id', userId)
    .eq('type', 'refund_pending')
    .in('status', OPEN_STATUSES);
  if (signalsError) throw new Error(signalsError.message);
  if (!openRefundSignals || openRefundSignals.length === 0) return [];

  const { data: creditTxs, error: txError } = await supabase
    .from('transactions')
    .select('id, amount, currency')
    .in('id', transactionIds)
    .eq('credit_debit_indicator', 'CRDT');
  if (txError) throw new Error(txError.message);

  const signalIds: number[] = [];
  const stillOpen = [...openRefundSignals];

  for (const tx of creditTxs ?? []) {
    const matchIndex = stillOpen.findIndex((signal) => {
      const value = signal.expected_value as { amount?: string; currency?: string } | null;
      if (!value?.amount || value.currency !== tx.currency) return false;
      return Math.abs(Number(value.amount) - Number(tx.amount)) < AMOUNT_TOLERANCE;
    });
    if (matchIndex === -1) continue;

    const [match] = stillOpen.splice(matchIndex, 1);
    await supabase.from('financial_signals').update({ matched_transaction_id: tx.id }).eq('id', match.id);
    await transitionSignal(supabase, userId, match.id, 'resolved', 'matching refund transaction landed');
    signalIds.push(match.id);
  }

  return signalIds;
}
