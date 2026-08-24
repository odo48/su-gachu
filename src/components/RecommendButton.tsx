'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RecommendButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
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
      <Button onClick={run} disabled={loading} size="sm">
        <Sparkles className="h-4 w-4" />
        {loading ? 'Generez...' : 'Generează planul'}
      </Button>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}
