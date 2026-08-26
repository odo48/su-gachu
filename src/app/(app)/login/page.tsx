'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type SocialProvider = 'google' | 'apple';

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return '/profile';
  return raw;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.74c.03 3.2 2.8 4.27 2.83 4.28-.02.07-.44 1.51-1.46 2.99-.88 1.28-1.79 2.55-3.23 2.58-1.41.03-1.87-.84-3.48-.84-1.62 0-2.12.81-3.46.86-1.39.05-2.45-1.38-3.34-2.65-1.83-2.61-3.23-7.38-1.35-10.6.93-1.6 2.6-2.62 4.4-2.65 1.37-.03 2.67.93 3.48.93.81 0 2.33-1.15 3.93-.98.67.03 2.55.27 3.76 2.04-.1.06-2.24 1.31-2.08 3.04ZM13.9 6.04c.74-.9 1.24-2.15 1.1-3.4-1.07.04-2.36.71-3.13 1.61-.69.8-1.29 2.08-1.13 3.3 1.19.09 2.42-.61 3.16-1.51Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<SocialProvider | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') !== 'oauth') return;
    const reason = params.get('reason');
    setMsg(
      reason
        ? `Autentificarea socială a eșuat: ${reason}`
        : 'Autentificarea socială a eșuat. Încearcă din nou.'
    );
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    const res = await fetch(mode === 'in' ? '/api/auth/login' : '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, website: honeypot, next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setMsg(typeof data.error === 'string' ? data.error : 'Eroare');
    if (mode === 'up') {
      router.push('/multumim');
      return;
    }
    router.push(typeof data.next === 'string' ? safeNext(data.next) : next);
    router.refresh();
  }

  async function oauth(provider: SocialProvider) {
    setOauthProvider(provider);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNext(new URLSearchParams(window.location.search).get('next'))
        )}`,
      },
    });
    if (error) {
      setOauthProvider(null);
      setMsg(error.message);
    }
  }

  const busy = loading || oauthProvider !== null;

  return (
    <Card id="cta" className="mx-auto max-w-sm">
      <CardHeader>
        <h1 className="font-heading text-2xl font-semibold leading-none tracking-tight">AI Coach</h1>
        <p className="text-sm text-muted-foreground">Răspuns în chat de obicei sub un minut.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => oauth('google')}
            className="w-full"
          >
            <GoogleIcon />
            {oauthProvider === 'google' ? 'Se conectează…' : 'Continuă cu Google'}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => oauth('apple')}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            <AppleIcon />
            {oauthProvider === 'apple' ? 'Se conectează…' : 'Continuă cu Apple'}
          </Button>
        </div>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs uppercase tracking-wide text-muted-foreground">
            sau
          </span>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              type="password"
              placeholder="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={128}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {loading ? '…' : mode === 'in' ? 'Intră în cont' : 'Creează cont'}
          </Button>
        </form>
        {msg && <p className="mt-3 text-sm text-destructive" role="alert">{msg}</p>}
        <Button
          type="button"
          variant="link"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          className="mt-2 h-auto px-0"
        >
          {mode === 'in' ? 'Nu ai cont? Înregistrează-te' : 'Ai deja cont? Loghează-te'}
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/faq" className="underline-offset-2 hover:underline">Întrebări frecvente</Link>
          {' · '}
          <Link href="/confidentialitate" className="underline-offset-2 hover:underline">
            Confidențialitate
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
