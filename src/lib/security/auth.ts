const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function safeNextPath(raw: unknown, fallback = '/profile'): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return fallback;
  return raw;
}

export function parseAuthBody(body: unknown):
  | { honeypot: true }
  | { error: string }
  | { email: string; password: string; next: string } {
  if (!body || typeof body !== 'object') return { error: 'Date invalide' };
  const o = body as Record<string, unknown>;
  if (typeof o.website === 'string' && o.website.trim().length > 0) return { honeypot: true };

  const email = String(o.email ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const password = String(o.password ?? '');
  if (!EMAIL_RE.test(email)) return { error: 'Email invalid' };
  if (password.length < 6 || password.length > 128) {
    return { error: 'Parola trebuie să aibă 6–128 de caractere' };
  }
  return { email, password, next: safeNextPath(o.next) };
}
