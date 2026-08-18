'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    setLoading(true); setMsg(null);
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
      <h1 className="mb-6 text-2xl font-bold">AI Coach</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full rounded border p-2" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded border p-2" type="password" placeholder="Parolă"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button disabled={loading}
          className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          {loading ? '...' : mode === 'in' ? 'Intră în cont' : 'Creează cont'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
        className="mt-4 text-sm text-brand underline">
        {mode === 'in' ? 'Nu ai cont? Înregistrează-te' : 'Ai deja cont? Loghează-te'}
      </button>
    </div>
  );
}
