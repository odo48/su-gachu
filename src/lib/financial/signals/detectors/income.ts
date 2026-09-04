import type { SupabaseClient } from '@supabase/supabase-js';
import { raiseSignal } from '../raise';

const MIN_OCCURRENCES = 3;
const LATE_TOLERANCE = 0.5;
const MIN_TOLERANCE_DAYS = 7;
const AMOUNT_CHANGE_RATIO = 0.2;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['detected', 'confirmed'];

interface IncomeStream {
  payer: string;
  currency: string;
  occurrences: Array<{ amount: number; date: string }>;
}

// Ported from transaction-manager's packages/signals/src/detectors/
// income.ts. Driven off the classified history rather than a stored
// schedule — the cadence *is* the gaps between the last few payments from a
// payer. `kind='income'` (Phase 0's flat categories) stands in for the
// source's isIncome column.
export async function detectIncomeSignals(supabase: SupabaseClient, userId: string): Promise<number[]> {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('debtor_name, normalized_payee, amount, currency, booking_date, categories!inner(kind)')
    .eq('user_id', userId)
    .eq('credit_debit_indicator', 'CRDT')
    .eq('categories.kind', 'income')
    .order('booking_date', { ascending: true });
  if (error) throw new Error(error.message);

  const streams = groupByPayer(
    (rows ?? []).map((r) => ({
      payer: r.debtor_name ?? r.normalized_payee,
      amount: Number(r.amount),
      currency: r.currency,
      date: r.booking_date,
    }))
  );

  const signalIds: number[] = [];
  for (const stream of streams) {
    if (stream.occurrences.length < MIN_OCCURRENCES) continue;
    const missing = await detectMissing(supabase, userId, stream);
    if (missing) signalIds.push(missing);
    const changed = await detectAmountChange(supabase, userId, stream);
    if (changed) signalIds.push(changed);
  }
  return signalIds;
}

function groupByPayer(
  rows: Array<{ payer: string | null; amount: number; currency: string; date: string }>
): IncomeStream[] {
  const groups = new Map<string, IncomeStream>();
  for (const row of rows) {
    if (!row.payer) continue;
    const key = `${row.payer}:${row.currency}`;
    const existing = groups.get(key);
    const occurrence = { amount: row.amount, date: row.date };
    if (existing) existing.occurrences.push(occurrence);
    else groups.set(key, { payer: row.payer, currency: row.currency, occurrences: [occurrence] });
  }
  return [...groups.values()];
}

async function detectMissing(supabase: SupabaseClient, userId: string, stream: IncomeStream): Promise<number | null> {
  const dates = stream.occurrences.map((o) => Date.parse(`${o.date}T12:00:00`));
  const last = dates[dates.length - 1];
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
  const averageGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  if (averageGap <= 0) return null;

  const tolerance = Math.max(averageGap * LATE_TOLERANCE, MIN_TOLERANCE_DAYS);
  const daysSinceLast = (Date.now() - last) / DAY_MS;
  if (daysSinceLast <= averageGap + tolerance) return null;

  const lastOccurrence = stream.occurrences[stream.occurrences.length - 1];
  const expectedOn = new Date(last + averageGap * DAY_MS).toISOString().slice(0, 10);
  const sourceId = `income_missing:${stream.payer}:${expectedOn}`;

  return insertOnce(supabase, userId, {
    type: 'income_missing',
    sourceId,
    expectedByDate: expectedOn,
    expectedValue: {
      payer: stream.payer,
      amount: lastOccurrence.amount.toFixed(2),
      currency: stream.currency,
      lastReceivedOn: lastOccurrence.date,
      averageIntervalDays: Math.round(averageGap),
    },
    confidence: 0.7,
  });
}

async function detectAmountChange(
  supabase: SupabaseClient,
  userId: string,
  stream: IncomeStream
): Promise<number | null> {
  const amounts = stream.occurrences.map((o) => o.amount);
  const latest = amounts[amounts.length - 1];
  const priorAmounts = amounts.slice(0, -1);
  const baseline = priorAmounts.reduce((sum, a) => sum + a, 0) / priorAmounts.length;
  if (baseline <= 0) return null;

  const change = Math.abs(latest - baseline) / baseline;
  if (change < AMOUNT_CHANGE_RATIO) return null;

  const lastDate = stream.occurrences[stream.occurrences.length - 1].date;
  return insertOnce(supabase, userId, {
    type: 'income_changed',
    sourceId: `income_changed:${stream.payer}:${lastDate}`,
    expectedValue: {
      payer: stream.payer,
      amount: latest.toFixed(2),
      previousAmount: baseline.toFixed(2),
      currency: stream.currency,
    },
    confidence: 0.6,
  });
}

async function insertOnce(
  supabase: SupabaseClient,
  userId: string,
  input: {
    type: 'income_missing' | 'income_changed';
    sourceId: string;
    expectedByDate?: string;
    expectedValue: Record<string, unknown>;
    confidence: number;
  }
): Promise<number | null> {
  const { data: existing } = await supabase
    .from('financial_signals')
    .select('id')
    .eq('user_id', userId)
    .eq('type', input.type)
    .eq('source_id', input.sourceId)
    .in('status', OPEN_STATUSES)
    .maybeSingle();
  if (existing) return null;

  return raiseSignal(supabase, {
    userId,
    type: input.type,
    sourceType: 'rule',
    sourceId: input.sourceId,
    expectedByDate: input.expectedByDate ?? null,
    expectedValue: input.expectedValue,
    confidence: input.confidence,
  });
}
