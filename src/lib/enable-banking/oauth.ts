export const EB_OAUTH_COOKIE = 'eb_oauth';
export const EB_OAUTH_MAX_AGE = 600;
export const ENABLE_BANKING_CALLBACK_PATH = '/api/enable-banking/callback';

export function enableBankingCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${ENABLE_BANKING_CALLBACK_PATH}`;
}

export function originFromRequest(reqOrigin: string, bodyOrigin?: unknown): string {
  const raw = typeof bodyOrigin === 'string' ? bodyOrigin.trim() : '';
  const candidate = raw || reqOrigin;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return reqOrigin;
    return parsed.origin;
  } catch {
    return reqOrigin;
  }
}

export type EbOAuthCookie = {
  state: string;
  name: string;
  country: string;
  psuType: 'personal' | 'business';
};

export function ebOAuthCookieOptions(maxAge = EB_OAUTH_MAX_AGE) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  };
}
