import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnableBankingBalances, getEnableBankingTransactions } from './client';

// Ported from jarvis-backend's Service/Financial/EnableBankingBalanceSyncService
// and EnableBankingTransactionSyncService, scoped to a single user's accounts.

export type BalanceSyncResult = { accountId: number; bank: string; success: boolean; balance: number | null; message: string };

async function syncAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  account: { id: number; account_id: string; bank: string }
): Promise<BalanceSyncResult> {
  try {
    const data = await getEnableBankingBalances(account.account_id);
    const balances = data?.balances ?? [];
    const amount = balances[0]?.balance_amount?.amount;
    if (amount === undefined || amount === null) {
      return { accountId: account.id, bank: account.bank, success: false, balance: null, message: `Could not find amount in balance data for account ${account.account_id}.` };
    }

    const { error } = await supabase.from('accounts').update({ balance: String(amount) }).eq('id', account.id).eq('user_id', userId);
    if (error) return { accountId: account.id, bank: account.bank, success: false, balance: null, message: error.message };

    return { accountId: account.id, bank: account.bank, success: true, balance: Number(amount), message: 'Balance synced.' };
  } catch (err) {
    return { accountId: account.id, bank: account.bank, success: false, balance: null, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function syncAllBalances(supabase: SupabaseClient, userId: string): Promise<BalanceSyncResult[]> {
  const { data: accounts, error } = await supabase.from('accounts').select('id, account_id, bank').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return Promise.all((accounts ?? []).map((a) => syncAccountBalance(supabase, userId, a)));
}

export type TransactionSyncResult = { accountId: number; bank: string; success: boolean; transactionsSynced: number; message: string };

async function syncAccountTransactions(
  supabase: SupabaseClient,
  userId: string,
  account: { id: number; account_id: string; bank: string },
  dateFrom: string,
  dateTo: string
): Promise<TransactionSyncResult> {
  try {
    const data = await getEnableBankingTransactions(account.account_id, dateFrom, dateTo);
    const transactions: any[] = data?.transactions ?? [];

    for (const t of transactions) {
      const externalReference = t.entry_reference;
      if (!externalReference || externalReference === 'NOT_PROVIDED') continue;

      const row = {
        user_id: userId,
        account_id: account.id,
        external_reference: externalReference,
        amount: String(t.transaction_amount.amount),
        currency: t.transaction_amount.currency,
        creditor_name: t.creditor?.name || null,
        debtor_name: t.debtor?.name || null,
        bank_transaction_code: t.bank_transaction_code?.code ?? t.bank_transaction_code?.description ?? null,
        credit_debit_indicator: t.credit_debit_indicator,
        status: t.status,
        booking_date: t.booking_date,
        value_date: t.value_date ?? null,
        remittance_information: Array.isArray(t.remittance_information) ? t.remittance_information.join(' ') : null,
      };

      // Only columns present in `row` are overwritten on conflict — category,
      // tags and notes (set later by classify_transaction) are left alone.
      const { error } = await supabase.from('transactions').upsert(row, { onConflict: 'account_id,external_reference' });
      if (error) throw new Error(error.message);
    }

    return { accountId: account.id, bank: account.bank, success: true, transactionsSynced: transactions.length, message: `Synced ${transactions.length} transactions.` };
  } catch (err) {
    return { accountId: account.id, bank: account.bank, success: false, transactionsSynced: 0, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function syncAllTransactions(
  supabase: SupabaseClient,
  userId: string,
  opts: { accountId?: number; dateFrom: string; dateTo: string }
): Promise<TransactionSyncResult[]> {
  let query = supabase.from('accounts').select('id, account_id, bank').eq('user_id', userId);
  if (opts.accountId) query = query.eq('id', opts.accountId);
  const { data: accounts, error } = await query;
  if (error) throw new Error(error.message);
  if (opts.accountId && (accounts ?? []).length === 0) {
    throw new Error(`Account ${opts.accountId} not found.`);
  }

  return Promise.all((accounts ?? []).map((a) => syncAccountTransactions(supabase, userId, a, opts.dateFrom, opts.dateTo)));
}
