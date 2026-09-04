import type { SupabaseClient } from '@supabase/supabase-js';
import { raiseSignal } from '../raise';

// Ported from transaction-manager's packages/signals/src/detectors/
// fraud-baseline.ts, statistical half only (no LLM second pass — see
// fraud-llm.ts in the source, dropped for this MVP). A modified z-score
// (median + MAD) over log(amount), computed in JS over the user's own
// non-transfer debit history rather than a Postgres RPC — cheap at
// personal-account volumes. Same thresholds as the source, chosen there by
// sweeping real transaction history.
const MODIFIED_Z_THRESHOLD = 2.25;
/** A guard rail, not a tuning knob — makes tiny transactions structurally unflaggable. */
const MINIMUM_FLAGGABLE_AMOUNT = 250;
/** Six samples is not a baseline; a new connection's first week shouldn't alarm. */
const MIN_HISTORY_SAMPLE = 30;
/** Puts MAD on the same scale as standard deviation. */
const MAD_TO_SIGMA = 0.6745;
/** Caps the signals themselves, regardless of what the statistics say. */
const MAX_FRAUD_SIGNALS_PER_MONTH = 8;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface HistoryRow {
  id: number;
  logAmount: number;
}

function baselineExcluding(history: HistoryRow[], excludeId: number) {
  const logAmounts = history.filter((r) => r.id !== excludeId).map((r) => r.logAmount);
  if (logAmounts.length < MIN_HISTORY_SAMPLE) return null;
  const logMedian = median(logAmounts);
  const logMad = median(logAmounts.map((v) => Math.abs(v - logMedian)));
  if (logMad <= 0) return null;
  return { logMedian, logMad };
}

function modifiedZScore(amount: number, baseline: { logMedian: number; logMad: number }): number {
  return (MAD_TO_SIGMA * (Math.log(amount + 1) - baseline.logMedian)) / baseline.logMad;
}

async function isKnownCounterparty(
  supabase: SupabaseClient,
  userId: string,
  transactionId: number,
  counterpartyName: string | null
): Promise<boolean> {
  if (!counterpartyName) return false;
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('creditor_name', counterpartyName)
    .neq('id', transactionId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function fraudBudgetExhausted(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { count, error } = await supabase
    .from('financial_signals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'fraud_anomaly')
    .gte('created_at', since.toISOString());
  if (error) throw new Error(error.message);
  return (count ?? 0) >= MAX_FRAUD_SIGNALS_PER_MONTH;
}

export async function detectFraudSignals(
  supabase: SupabaseClient,
  userId: string,
  candidateTransactionIds: number[]
): Promise<number[]> {
  if (candidateTransactionIds.length === 0) return [];
  if (await fraudBudgetExhausted(supabase, userId)) return [];

  const { data: history, error: historyError } = await supabase
    .from('transactions')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('credit_debit_indicator', 'DBIT')
    .eq('is_internal_transfer', false)
    .gt('amount', 0);
  if (historyError) throw new Error(historyError.message);
  const historyRows: HistoryRow[] = (history ?? []).map((r) => ({ id: r.id, logAmount: Math.log(Number(r.amount) + 1) }));

  const { data: candidates, error: candidatesError } = await supabase
    .from('transactions')
    .select('id, amount, currency, creditor_name, remittance_information')
    .eq('user_id', userId)
    .eq('credit_debit_indicator', 'DBIT')
    .eq('is_internal_transfer', false)
    .in('id', candidateTransactionIds);
  if (candidatesError) throw new Error(candidatesError.message);

  const signalIds: number[] = [];
  for (const tx of candidates ?? []) {
    const amount = Number(tx.amount);
    if (amount < MINIMUM_FLAGGABLE_AMOUNT) continue;

    const baseline = baselineExcluding(historyRows, tx.id);
    if (!baseline) continue;

    const score = modifiedZScore(amount, baseline);
    if (score <= MODIFIED_Z_THRESHOLD) continue;

    if (await isKnownCounterparty(supabase, userId, tx.id, tx.creditor_name)) continue;
    if (await fraudBudgetExhausted(supabase, userId)) break;

    const { data: existing } = await supabase
      .from('financial_signals')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'fraud_anomaly')
      .eq('source_id', String(tx.id))
      .maybeSingle();
    if (existing) continue;

    const inserted = await raiseSignal(supabase, {
      userId,
      type: 'fraud_anomaly',
      sourceType: 'transaction',
      sourceId: String(tx.id),
      matchedTransactionId: tx.id,
      expectedValue: { description: tx.remittance_information, amount: amount.toFixed(2), currency: tx.currency },
      confidence: Math.min(1, score / (MODIFIED_Z_THRESHOLD * 2)),
    });
    if (inserted) signalIds.push(inserted);
  }

  return signalIds;
}
