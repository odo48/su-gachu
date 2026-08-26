import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_ENABLE_BANKING_API_URL,
  EnableBankingNotConfiguredError,
  type EnableBankingCreds,
} from './jwt';

export async function getEnableBankingCreds(userId: string): Promise<EnableBankingCreds | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('enable_banking_connections')
    .select('app_id, api_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !row?.app_id) return null;

  const { data: secret, error: secretError } = await admin.rpc('get_enable_banking_secret', {
    p_user_id: userId,
  });
  if (secretError || typeof secret !== 'string' || !secret) return null;

  return {
    appId: row.app_id,
    privateKeyPem: secret,
    apiUrl: row.api_url || DEFAULT_ENABLE_BANKING_API_URL,
  };
}

export async function requireEnableBankingCreds(userId: string): Promise<EnableBankingCreds> {
  const creds = await getEnableBankingCreds(userId);
  if (!creds) throw new EnableBankingNotConfiguredError();
  return creds;
}
