import type { SupabaseClient } from '@supabase/supabase-js';
import { accountIbanFromEnableBanking } from './client';

function accountCurrency(raw: unknown): string {
  const letters = String(raw ?? 'RON')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase();
  return letters.length === 3 ? letters : 'RON';
}

type EnableBankingSessionPayload = {
  session_id?: string;
  access?: { valid_until?: string };
  accounts?: Array<{
    uid?: string;
    currency?: string;
    account_id?: { iban?: string };
    all_account_ids?: Array<{ identification?: string; scheme_name?: string }>;
  }>;
};

export async function persistEnableBankingSession(
  supabase: SupabaseClient,
  userId: string,
  session: EnableBankingSessionPayload,
  aspsp: { name: string; country: string }
): Promise<number> {
  const accounts = Array.isArray(session.accounts) ? session.accounts : [];
  let saved = 0;

  for (const acc of accounts) {
    const uid = typeof acc.uid === 'string' ? acc.uid.trim() : '';
    if (!uid) continue;

    const { error } = await supabase.from('accounts').upsert(
      {
        user_id: userId,
        account_id: uid,
        bank: aspsp.name,
        currency: accountCurrency(acc.currency),
        iban: accountIbanFromEnableBanking(acc),
      },
      { onConflict: 'user_id,account_id' }
    );
    if (error) throw new Error(error.message);
    saved += 1;
  }

  const sessionId = typeof session.session_id === 'string' ? session.session_id : '';
  if (sessionId) {
    const { error: sessionError } = await supabase.from('enable_banking_sessions').upsert({
      user_id: userId,
      session_id: sessionId,
      aspsp_name: aspsp.name,
      aspsp_country: aspsp.country,
      valid_until: session.access?.valid_until ?? null,
      updated_at: new Date().toISOString(),
    });
    if (sessionError) {
      console.error('enable_banking_sessions upsert failed', sessionError.message);
    }
  }

  if (saved > 0) {
    await supabase.from('user_modules').upsert(
      { user_id: userId, module: 'financial', enabled: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );
  }

  return saved;
}
