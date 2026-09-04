import type { SupabaseClient } from '@supabase/supabase-js';
import { raiseSignal } from '../raise';
import { transitionSignal } from '../lifecycle';

const STILL_USING_THRESHOLD = 6;
const OPEN_STATUSES = ['detected', 'confirmed'];
const DAY_MS = 24 * 60 * 60 * 1000;

interface Occurrence {
  transactionId: number;
  amount: number;
  currency: string;
  date: string;
  normalizedPayee: string | null;
}

// Ported from transaction-manager's packages/signals/src/detectors/
// subscription.ts. Builds on Phase 1's recurrence grouping: once a group has
// >= 2 occurrences, predicts the next charge date from the average interval
// between them and resolves the previous open prediction when a new
// matching transaction lands. An internal transfer is never a subscription,
// however regular it is — excluded even if a group somehow predates that
// rule (enrich-tools-write.ts already forces isRecurring=false for one).
export async function detectSubscriptionSignals(supabase: SupabaseClient, userId: string): Promise<number[]> {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, amount, currency, booking_date, normalized_payee, recurrence_group_id')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .eq('is_internal_transfer', false)
    .not('recurrence_group_id', 'is', null)
    .order('booking_date', { ascending: true });
  if (error) throw new Error(error.message);

  const groups = new Map<string, Occurrence[]>();
  for (const row of rows ?? []) {
    const groupId = row.recurrence_group_id as string;
    const list = groups.get(groupId) ?? [];
    list.push({
      transactionId: row.id,
      amount: Number(row.amount),
      currency: row.currency,
      date: row.booking_date,
      normalizedPayee: row.normalized_payee,
    });
    groups.set(groupId, list);
  }

  const signalIds: number[] = [];
  for (const [groupId, occurrences] of groups) {
    if (occurrences.length < 2) continue;
    signalIds.push(...(await evaluateGroup(supabase, userId, groupId, occurrences)));
  }
  return signalIds;
}

async function evaluateGroup(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  occurrences: Occurrence[]
): Promise<number[]> {
  const dates = occurrences.map((o) => Date.parse(`${o.date}T12:00:00`));
  const intervalsDays = dates.slice(1).map((date, i) => (date - dates[i]) / DAY_MS);
  const avgIntervalDays = intervalsDays.reduce((sum, d) => sum + d, 0) / intervalsDays.length;

  const lastDate = new Date(dates[dates.length - 1]);
  const predictedNextDate = new Date(lastDate.getTime() + avgIntervalDays * DAY_MS).toISOString().slice(0, 10);
  const latest = occurrences[occurrences.length - 1];

  const { data: openRenewal } = await supabase
    .from('financial_signals')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'subscription_renewal')
    .eq('source_id', groupId)
    .in('status', OPEN_STATUSES)
    .maybeSingle();

  const signalIds: number[] = [];
  if (openRenewal) {
    await transitionSignal(supabase, userId, openRenewal.id, 'resolved', 'matching renewal transaction landed');
  }

  const inserted = await raiseSignal(supabase, {
    userId,
    type: 'subscription_renewal',
    status: openRenewal ? 'confirmed' : 'detected',
    sourceType: 'rule',
    sourceId: groupId,
    matchedTransactionId: openRenewal ? latest.transactionId : null,
    expectedValue: { payee: latest.normalizedPayee, amount: latest.amount, currency: latest.currency },
    expectedByDate: predictedNextDate,
  });
  if (inserted) signalIds.push(inserted);

  const stillUsingId = await maybeCreateStillUsingSignal(
    supabase,
    userId,
    groupId,
    latest.normalizedPayee,
    occurrences.length
  );
  if (stillUsingId) signalIds.push(stillUsingId);

  return signalIds;
}

async function maybeCreateStillUsingSignal(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  normalizedPayee: string | null,
  occurrenceCount: number
): Promise<number | null> {
  if (occurrenceCount < STILL_USING_THRESHOLD) return null;

  const { data: existing } = await supabase
    .from('financial_signals')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'subscription_still_using')
    .eq('source_id', groupId)
    .maybeSingle();
  if (existing) return null;

  return raiseSignal(supabase, {
    userId,
    type: 'subscription_still_using',
    sourceType: 'rule',
    sourceId: groupId,
    expectedValue: { payee: normalizedPayee, occurrenceCount },
  });
}
