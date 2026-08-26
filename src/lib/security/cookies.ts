import type { CookieOptions } from '@supabase/ssr';

export function withSecureCookies(options: CookieOptions): CookieOptions {
  return {
    ...options,
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
  };
}
