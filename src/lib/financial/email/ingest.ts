import type { SupabaseClient } from '@supabase/supabase-js';
import { getGmailAppCreds, listMessageMetadata } from '../../gmail/client';
import { requireGmailRefreshToken } from '../../gmail/connection';

// Ported from transaction-manager's packages/email-ingestion/src/ingest.ts
// (pass 1 of 3): list message metadata for the window and upsert into
// gmail_emails, keyed on (user_id, gmail_message_id) so a re-run over an
// overlapping window is free and never re-touches an already-screened row.
const DEFAULT_SINCE_HOURS = 24;

export async function ingestGmail(
  supabase: SupabaseClient,
  userId: string,
  opts: { sinceHours?: number } = {}
): Promise<{ ingested: number }> {
  const creds = getGmailAppCreds();
  const refreshToken = await requireGmailRefreshToken(userId);
  const messages = await listMessageMetadata(creds, {
    refreshToken,
    sinceHours: opts.sinceHours ?? DEFAULT_SINCE_HOURS,
  });
  if (messages.length === 0) return { ingested: 0 };

  const rows = messages.map((m) => ({
    user_id: userId,
    gmail_message_id: m.id,
    subject: m.subject,
    from_address: m.fromAddress,
    to_address: m.toAddress,
    snippet: m.snippet,
    received_at: m.receivedAt,
  }));

  const { error } = await supabase
    .from('gmail_emails')
    .upsert(rows, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  await supabase.from('gmail_connections').update({ last_synced_at: new Date().toISOString() }).eq('user_id', userId);

  return { ingested: rows.length };
}
