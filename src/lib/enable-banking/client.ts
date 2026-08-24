import { generateEnableBankingToken } from './jwt';

// Ported from jarvis-backend's EnableBanking/EnableBankingClient.php.
async function callEnableBanking(path: string, query: Record<string, string> = {}): Promise<any> {
  const baseUrl = process.env.ENABLE_BANKING_URL!;
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${generateEnableBankingToken()}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Enable Banking API request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getEnableBankingTransactions(accountId: string, dateFrom?: string, dateTo?: string): Promise<any> {
  const query: Record<string, string> = {};
  if (dateFrom) query.date_from = dateFrom;
  if (dateTo) query.date_to = dateTo;
  return callEnableBanking(`/accounts/${accountId}/transactions`, query);
}

export async function getEnableBankingBalances(accountId: string): Promise<any> {
  return callEnableBanking(`/accounts/${accountId}/balances`);
}
