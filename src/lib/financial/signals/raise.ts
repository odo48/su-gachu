import type { SupabaseClient } from '@supabase/supabase-js';
import { SIGNAL_REGISTRY, type SignalType } from './registry';

// Ported from transaction-manager's packages/signals/src/raise.ts: the one
// place a financial_signals row is created. `priority` is derived from the
// registry rather than passed in, so it can't drift from what the type
// declares.
export interface RaiseSignalParams {
  userId: string;
  type: SignalType;
  sourceType: 'email' | 'transaction' | 'rule';
  sourceId?: string | null;
  expectedValue?: unknown;
  expectedByDate?: string | null;
  matchedTransactionId?: number | null;
  confidence?: number | null;
  status?: 'detected' | 'confirmed';
}

export async function raiseSignal(supabase: SupabaseClient, params: RaiseSignalParams): Promise<number | null> {
  const { data, error } = await supabase
    .from('financial_signals')
    .insert({
      user_id: params.userId,
      type: params.type,
      status: params.status ?? 'detected',
      source_type: params.sourceType,
      source_id: params.sourceId ?? null,
      expected_value: params.expectedValue ?? null,
      expected_by_date: params.expectedByDate ?? null,
      matched_transaction_id: params.matchedTransactionId ?? null,
      confidence: params.confidence ?? null,
      priority: SIGNAL_REGISTRY[params.type].priority,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
