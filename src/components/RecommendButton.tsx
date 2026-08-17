'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

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
          className="rounded border border-gray-300 px-2 py-2 text-sm disabled:opacity-50"
        >
          <option value="gemini">Gemini</option>
          <option value="claude">Claude</option>
        </select>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50">
          <Sparkles size={16} /> {loading ? 'Generez...' : 'Generează planul zilei'}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
