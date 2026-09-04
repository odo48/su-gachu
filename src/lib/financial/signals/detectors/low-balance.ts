import type { SupabaseClient } from '@supabase/supabase-js';
import { raiseSignal } from '../raise';
import { transitionSignal } from '../lifecycle';

const FORECAST_WINDOW_DAYS = 7;
const OPEN_STATUSES = ['detected', 'confirmed'];

// Ported from transaction-manager's packages/signals/src/detectors/
// low-balance.ts: sums the user's open subscription_renewal signals due
// within the next 7 days per currency and compares against each account's
// current balance.
export async function detectLowBalanceSignals(supabase: SupabaseClient, userId: string): Promise<number[]> {
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, bank, balance, currency')
    .eq('user_id', userId);
  if (accountsError) throw new Error(accountsError.message);

  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = new Date(Date.now() + FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: upcomingRenewals, error: renewalsError } = await supabase
    .from('financial_signals')
    .select('expected_value, expected_by_date')
    .eq('user_id', userId)
    .eq('type', 'subscription_renewal')
    .in('status', OPEN_STATUSES)
    .gte('expected_by_date', today)
    .lte('expected_by_date', windowEnd);
  if (renewalsError) throw new Error(renewalsError.message);

  const signalIds: number[] = [];

  for (const account of accounts ?? []) {
    const upcomingTotal = (upcomingRenewals ?? []).reduce((sum, renewal) => {
      const value = renewal.expected_value as { amount?: string; currency?: string } | null;
      if (!value || value.currency !== account.currency) return sum;
      return sum + Number(value.amount ?? 0);
    }, 0);

    const { data: existing } = await supabase
      .from('financial_signals')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'low_balance_forecast')
      .eq('source_id', String(account.id))
      .in('status', OPEN_STATUSES)
      .maybeSingle();

    const balance = Number(account.balance);
    const isShortfall = upcomingTotal > balance;

    if (isShortfall && !existing) {
      const inserted = await raiseSignal(supabase, {
        userId,
        type: 'low_balance_forecast',
        sourceType: 'rule',
        sourceId: String(account.id),
        expectedValue: {
          accountName: account.bank,
          balance: account.balance,
          currency: account.currency,
          upcomingTotal: upcomingTotal.toFixed(2),
        },
        expectedByDate: windowEnd,
      });
      if (inserted) signalIds.push(inserted);
    } else if (!isShortfall && existing) {
      await transitionSignal(supabase, userId, existing.id, 'resolved', 'balance now covers upcoming charges');
      signalIds.push(existing.id);
    }
  }

  return signalIds;
}
