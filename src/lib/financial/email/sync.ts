import type { SupabaseClient } from '@supabase/supabase-js';
import { getGmailAppCreds, getMessageBody } from '../../gmail/client';
import { requireGmailRefreshToken } from '../../gmail/connection';
import { ingestGmail } from './ingest';
import { screenEmails, type ScreenableEmail } from './screen';
import { analyzeEmail } from './analyze';
import { createSignalFromClassification } from './signals-from-email';

// Orchestrates the 3-pass pipeline (list → screen → analyze) synchronously
// within one request — no queue — triggered by the Gmail "Sincronizează"
// action. Bounded per run the same way lib/financial/enrich.ts is.
const MAX_ANALYZE_PER_RUN = 20;

export interface EmailSyncOptions {
  sinceHours?: number;
  provider?: string;
}

export interface EmailSyncResult {
  ingested: number;
  screened: number;
  analyzed: number;
  signalsRaised: number;
  remaining: number;
}

export async function runEmailSync(
  supabase: SupabaseClient,
  userId: string,
  opts: EmailSyncOptions = {}
): Promise<EmailSyncResult> {
  const provider = opts.provider ?? 'claude';
  const { data: jobRun } = await supabase
    .from('finance_job_runs')
    .insert({ user_id: userId, job_type: 'email_ingest', status: 'running' })
    .select('id')
    .single();

  try {
    const { ingested } = await ingestGmail(supabase, userId, { sinceHours: opts.sinceHours });

    const { data: pendingRows, error: pendingError } = await supabase
      .from('gmail_emails')
      .select('id, gmail_message_id, subject, from_address, to_address, snippet, received_at')
      .eq('user_id', userId)
      .eq('screening', 'pending');
    if (pendingError) throw new Error(pendingError.message);

    const screenable: ScreenableEmail[] = (pendingRows ?? []).map((r) => ({
      id: r.id,
      gmailMessageId: r.gmail_message_id,
      subject: r.subject,
      fromAddress: r.from_address,
      toAddress: r.to_address,
      snippet: r.snippet,
      receivedAt: r.received_at,
    }));

    const { verdicts } = await screenEmails(provider, screenable);
    for (const email of screenable) {
      const verdict = verdicts.get(email.gmailMessageId);
      if (!verdict) continue; // unmentioned id stays pending, re-screened next run
      await supabase
        .from('gmail_emails')
        .update({ screening: verdict.selected ? 'selected' : 'skipped', screening_reason: verdict.reason })
        .eq('id', email.id);
    }

    const { data: selectedRows, error: selectedError } = await supabase
      .from('gmail_emails')
      .select('id, gmail_message_id, subject, from_address, to_address, received_at')
      .eq('user_id', userId)
      .eq('screening', 'selected')
      .is('analyzed_at', null)
      .limit(MAX_ANALYZE_PER_RUN);
    if (selectedError) throw new Error(selectedError.message);

    const creds = getGmailAppCreds();
    const refreshToken = await requireGmailRefreshToken(userId);

    let analyzed = 0;
    let signalsRaised = 0;
    for (const row of selectedRows ?? []) {
      const { body } = await getMessageBody(creds, { refreshToken, id: row.gmail_message_id });
      const classification = await analyzeEmail({
        supabase,
        userId,
        provider,
        emailId: row.id,
        subject: row.subject,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        receivedAt: row.received_at,
        body,
      });
      if (!classification) continue;
      analyzed += 1;
      const signalId = await createSignalFromClassification(supabase, userId, row.id, classification);
      if (signalId) signalsRaised += 1;
    }

    const { count: remaining } = await supabase
      .from('gmail_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('screening', 'selected')
      .is('analyzed_at', null);

    await supabase
      .from('finance_job_runs')
      .update({ status: 'succeeded', items_processed: analyzed, finished_at: new Date().toISOString() })
      .eq('id', jobRun?.id);

    return { ingested, screened: screenable.length, analyzed, signalsRaised, remaining: remaining ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('finance_job_runs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', jobRun?.id);
    throw err;
  }
}
