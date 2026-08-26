import { createPrivateKey, createSign } from 'crypto';

const DEFAULT_EXPIRATION_SECONDS = 3600;
export const DEFAULT_ENABLE_BANKING_API_URL = 'https://api.enablebanking.com';

export type EnableBankingCreds = {
  appId: string;
  privateKeyPem: string;
  apiUrl: string;
};

export class EnableBankingNotConfiguredError extends Error {
  constructor() {
    super('Salvează App ID și cheia PEM din Enable Banking (Control Panel) ca să continui.');
    this.name = 'EnableBankingNotConfiguredError';
  }
}

export function generateEnableBankingToken(creds: EnableBankingCreds): string {
  const url = creds.apiUrl || DEFAULT_ENABLE_BANKING_API_URL;
  const privateKey = parseEnableBankingPrivateKey(creds.privateKeyPem);

  const header = { alg: 'RS256', typ: 'JWT', kid: creds.appId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: url.replace('https://api.', ''),
    aud: url.replace('https://', ''),
    iat: now,
    exp: now + DEFAULT_EXPIRATION_SECONDS,
  };

  const base64Url = (data: string) => Buffer.from(data).toString('base64url');
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey).toString('base64url');

  return `${signingInput}.${signature}`;
}

export function parseEnableBankingPrivateKey(raw: string) {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (!key.includes('BEGIN')) {
    throw new Error('Cheia nu e un PEM valid (lipsește BEGIN).');
  }
  if (!key.includes('END PRIVATE KEY') && !key.includes('END RSA PRIVATE KEY')) {
    throw new Error('Cheia PEM e incompletă (lipsește END). Copiază tot fișierul, inclusiv linia de final.');
  }
  if (!key.endsWith('\n')) key += '\n';
  return createPrivateKey(key);
}
