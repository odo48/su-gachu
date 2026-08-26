import {
  DEFAULT_ENABLE_BANKING_API_URL,
  EnableBankingNotConfiguredError,
  generateEnableBankingToken,
  type EnableBankingCreds,
} from './jwt';

async function enableBankingFetch(
  creds: EnableBankingCreds,
  path: string,
  init: RequestInit = {}
): Promise<any> {
  const base = creds.apiUrl || DEFAULT_ENABLE_BANKING_API_URL;
  const url = new URL(path, base);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${generateEnableBankingToken(creds)}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Enable Banking ${res.status}: ${text.slice(0, 400) || res.statusText}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Enable Banking: răspuns non-JSON: ${text.slice(0, 200)}`);
  }
}

export { EnableBankingNotConfiguredError };

export async function getEnableBankingTransactions(
  creds: EnableBankingCreds,
  accountId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const query: Record<string, string> = {};
  if (dateFrom) query.date_from = dateFrom;
  if (dateTo) query.date_to = dateTo;
  const url = new URL(`/accounts/${accountId}/transactions`, creds.apiUrl || DEFAULT_ENABLE_BANKING_API_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return enableBankingFetch(creds, `${url.pathname}${url.search}`);
}

export async function getEnableBankingBalances(creds: EnableBankingCreds, accountId: string) {
  return enableBankingFetch(creds, `/accounts/${accountId}/balances`);
}

export type Aspsp = {
  name: string;
  country: string;
  bic?: string;
  logo?: string;
  maximumConsentValidity?: number;
};

export function consentValidUntilIso(maximumConsentValiditySeconds?: number): string {
  const maxMs = 90 * 24 * 60 * 60 * 1000;
  const bankMs =
    typeof maximumConsentValiditySeconds === 'number' && maximumConsentValiditySeconds > 0
      ? maximumConsentValiditySeconds * 1000
      : maxMs;
  return new Date(Date.now() + Math.min(maxMs, bankMs)).toISOString();
}

export function accountIbanFromEnableBanking(account: {
  uid?: string;
  account_id?: { iban?: string };
  all_account_ids?: Array<{ identification?: string; scheme_name?: string }>;
}): string {
  const iban = account.account_id?.iban;
  if (iban) return iban;
  const fromList = account.all_account_ids?.find(
    (item) => item.scheme_name === 'IBAN' && item.identification
  )?.identification;
  if (fromList) return fromList;
  return account.uid ? `uid:${account.uid}` : 'UNKNOWN';
}

export async function getEnableBankingAspsps(
  creds: EnableBankingCreds,
  country: string,
  psuType = 'personal'
): Promise<Aspsp[]> {
  const url = new URL('/aspsps', creds.apiUrl || DEFAULT_ENABLE_BANKING_API_URL);
  url.searchParams.set('country', country);
  url.searchParams.set('psu_type', psuType);
  url.searchParams.set('service', 'AIS');
  const data = await enableBankingFetch(creds, `${url.pathname}${url.search}`);
  return (data?.aspsps ?? []).map(
    (a: {
      name: string;
      country: string;
      bic?: string;
      logo?: string;
      maximum_consent_validity?: number;
    }) => ({
      name: a.name,
      country: a.country,
      bic: a.bic,
      logo: a.logo,
      maximumConsentValidity: a.maximum_consent_validity,
    })
  );
}

export async function startEnableBankingAuth(
  creds: EnableBankingCreds,
  opts: {
    aspspName: string;
    aspspCountry: string;
    redirectUrl: string;
    state: string;
    psuType?: 'personal' | 'business';
    validUntilIso: string;
  }
) {
  return enableBankingFetch(creds, '/auth', {
    method: 'POST',
    body: JSON.stringify({
      access: { valid_until: opts.validUntilIso },
      aspsp: { name: opts.aspspName, country: opts.aspspCountry },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: opts.psuType ?? 'personal',
      language: 'ro',
    }),
  }) as Promise<{ url: string; authorization_id?: string }>;
}

export async function authorizeEnableBankingSession(creds: EnableBankingCreds, code: string) {
  return enableBankingFetch(creds, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
