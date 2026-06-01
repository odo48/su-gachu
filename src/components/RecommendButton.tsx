'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export default function RecommendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true); setErr(null);
    const res = await fetch('/api/recommend', { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setErr(j.error ?? 'Eroare la generare');
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={run} disabled={loading}
        className="flex items-center gap-2 rounded bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        <Sparkles size={16} /> {loading ? 'Generez...' : 'Generează planul zilei'}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
