// Mirrors src/lib/enable-banking/oauth.ts's cookie/state pattern.
export const GMAIL_OAUTH_COOKIE = 'gmail_oauth';
export const GMAIL_OAUTH_MAX_AGE = 600;
export const GMAIL_CALLBACK_PATH = '/api/gmail/callback';

export function gmailCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}${GMAIL_CALLBACK_PATH}`;
}

export function gmailOAuthCookieOptions(maxAge = GMAIL_OAUTH_MAX_AGE) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  };
}
