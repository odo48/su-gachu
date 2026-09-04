import { createAdminClient } from '@/lib/supabase/admin';

// Mirrors src/lib/enable-banking/connection.ts: reads the per-user refresh
// token out of Supabase Vault via a service_role-only RPC.
export async function getGmailRefreshToken(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('gmail_connections')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || row?.status !== 'active') return null;

  const { data: token, error: tokenError } = await admin.rpc('get_gmail_refresh_token', { p_user_id: userId });
  if (tokenError || typeof token !== 'string' || !token) return null;
  return token;
}

export async function requireGmailRefreshToken(userId: string): Promise<string> {
  const token = await getGmailRefreshToken(userId);
  if (!token) throw new Error('Gmail nu este conectat.');
  return token;
}
