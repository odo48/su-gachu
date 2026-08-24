'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fn = mode === 'in'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) return setMsg(error.message);
    if (mode === 'up') return setMsg('Cont creat. Verifică emailul sau loghează-te.');
    router.push('/profile');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Su Gachu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <input className="input" type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Parolă"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '...' : mode === 'in' ? 'Intră în cont' : 'Creează cont'}
            </Button>
          </form>
          {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
          <Button variant="link" size="sm" className="mt-4 px-0" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'Nu ai cont? Înregistrează-te' : 'Ai deja cont? Loghează-te'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
