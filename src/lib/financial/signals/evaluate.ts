import type { SupabaseClient } from '@supabase/supabase-js';
import { detectFraudSignals } from './detectors/fraud';
import { detectSubscriptionSignals } from './detectors/subscription';
import { detectLowBalanceSignals } from './detectors/low-balance';
import { detectIncomeSignals } from './detectors/income';
import { detectRefundMatches } from './detectors/refund-match';

// Ported from transaction-manager's packages/signals/src/evaluate.ts, run
// synchronously (no queue) from the "Verifică semnale" action instead of on
// every new transaction batch. Runs every detector for the user; the
// candidate window bounds how far back fraud/refund-match look at specific
// transactions (subscription/low-balance/income scan the user's full
// classified history, since a shrinking balance or a missed payment can
// newly cross a threshold with no new transaction at all).
const CANDIDATE_WINDOW_DAYS = 30;

export interface SignalEvaluationResult {
  newSignalIds: number[];
}

export async function runSignalEvaluation(supabase: SupabaseClient, userId: string): Promise<SignalEvaluationResult> {
  const { data: jobRun } = await supabase
    .from('finance_job_runs')
    .insert({ user_id: userId, job_type: 'signals', status: 'running' })
    .select('id')
    .single();

  try {
    const since = new Date();
    since.setDate(since.getDate() - CANDIDATE_WINDOW_DAYS);
    const { data: recentTxs, error } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .gte('booking_date', since.toISOString().slice(0, 10));
    if (error) throw new Error(error.message);
    const recentIds = (recentTxs ?? []).map((r) => r.id);

    const fraudIds = await detectFraudSignals(supabase, userId, recentIds);
    const subscriptionIds = await detectSubscriptionSignals(supabase, userId);
    const lowBalanceIds = await detectLowBalanceSignals(supabase, userId);
    const incomeIds = await detectIncomeSignals(supabase, userId);
    const refundIds = await detectRefundMatches(supabase, userId, recentIds);

    const newSignalIds = [...fraudIds, ...subscriptionIds, ...lowBalanceIds, ...incomeIds, ...refundIds];

    await supabase
      .from('finance_job_runs')
      .update({ status: 'succeeded', items_processed: newSignalIds.length, finished_at: new Date().toISOString() })
      .eq('id', jobRun?.id);

    return { newSignalIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('finance_job_runs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', jobRun?.id);
    throw err;
  }
}
