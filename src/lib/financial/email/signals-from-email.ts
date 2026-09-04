import type { SupabaseClient } from '@supabase/supabase-js';
import { raiseSignal } from '../signals/raise';
import type { EmailAnalysisResult } from './analyze';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Ported from transaction-manager's packages/email-ingestion/src/
// signals-from-email.ts: wires classification into the Phase 2 signals
// engine. Only refund_promise/trial_ending map to a signal type today.
export async function createSignalFromClassification(
  supabase: SupabaseClient,
  userId: string,
  emailId: number,
  classification: EmailAnalysisResult
): Promise<number | null> {
  const signalType =
    classification.category === 'refund_promise'
      ? 'refund_pending'
      : classification.category === 'trial_ending'
        ? 'trial_ending'
        : null;
  if (!signalType) return null;

  const raw = classification.extractedFields.expectedByDate;
  const expectedByDate = typeof raw === 'string' && ISO_DATE_PATTERN.test(raw) ? raw : null;

  return raiseSignal(supabase, {
    userId,
    type: signalType,
    sourceType: 'email',
    sourceId: String(emailId),
    expectedValue: classification.extractedFields,
    expectedByDate,
    confidence: classification.confidence,
  });
}
