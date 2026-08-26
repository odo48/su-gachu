'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Provider = 'gemini' | 'claude';

export default function RecommendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>('gemini');

  async function run() {
    setLoading(true); setErr(null);
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setErr(j.error ?? 'Eroare la generare');
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          disabled={loading}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <Button onClick={run} disabled={loading}>
          <Sparkles /> {loading ? 'Generez...' : 'Generează planul zilei'}
        </Button>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
