import { createSign } from 'crypto';

const DEFAULT_EXPIRATION_SECONDS = 3600;

// Ported from jarvis-backend's EnableBanking/JwtTokenGenerator.php. Unlike
// Home Assistant/Ultrahuman, Enable Banking authenticates at the
// *application* level — one private key + app ID registered with Enable
// Banking for the whole app, not per end-user — so this stays a single
// app-wide secret (ENABLE_BANKING_PRIVATE_KEY), same as e.g. GEMINI_API_KEY.
// What's actually per-user is which account_ids a user has linked, recorded
// in the accounts table.
export function generateEnableBankingToken(): string {
  const url = process.env.ENABLE_BANKING_URL!;
  const appId = process.env.ENABLE_BANKING_APP_ID!;
  // Accepts a PEM string with literal "\n" escapes (common when a multi-line
  // key is stored as a single env var).
  const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const header = { alg: 'RS256', typ: 'JWT', kid: appId };
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
