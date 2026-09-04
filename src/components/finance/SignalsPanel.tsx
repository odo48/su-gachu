'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SIGNAL_REGISTRY, type SignalPriority, type SignalType } from '@/lib/financial/signals/registry';

type Signal = {
  id: number;
  type: SignalType;
  priority: SignalPriority;
  expected_value: unknown;
  expected_by_date: string | null;
  confidence: number | null;
  created_at: string;
};

const PRIORITY_ORDER: Record<SignalPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_BADGE: Record<SignalPriority, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};

export default function SignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/financial/signals');
    const data = await res.json().catch(() => []);
    setSignals(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function evaluate() {
    setEvaluating(true);
    setMsg(null);
    const res = await fetch('/api/financial/signals/evaluate', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setEvaluating(false);
    if (!res.ok) {
      setMsg(data.error ?? 'Verificarea a eșuat.');
      return;
    }
    setMsg(`${(data.newSignalIds ?? []).length} semnale noi/actualizate.`);
    await refresh();
  }

  async function act(id: number, status: 'resolved' | 'dismissed') {
    setBusyId(id);
    const res = await fetch(`/api/financial/signals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut actualiza semnalul.');
      return;
    }
    setSignals((prev) => prev.filter((s) => s.id !== id));
  }

  const sorted = [...signals].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Semnale</h2>
          <p className="text-sm text-muted-foreground">Alerte proactive despre abonamente, sold și venituri.</p>
        </div>
        <Button type="button" variant="outline" disabled={evaluating} onClick={evaluate}>
          <RefreshCw className="h-4 w-4" />
          {evaluating ? 'Verific…' : 'Verifică semnale'}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Încarc semnalele…</p>
        ) : sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Niciun semnal activ.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((signal) => {
              const entry = SIGNAL_REGISTRY[signal.type];
              const notification = entry.buildNotification({
                type: signal.type,
                expectedValue: signal.expected_value,
                expectedByDate: signal.expected_by_date,
              });
              return (
                <li key={signal.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {signal.priority === 'critical' || signal.priority === 'high' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      <Badge variant={PRIORITY_BADGE[signal.priority]}>{entry.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === signal.id}
                      onClick={() => act(signal.id, 'resolved')}
                    >
                      Rezolvat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === signal.id}
                      onClick={() => act(signal.id, 'dismissed')}
                    >
                      Ignoră
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {msg && (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
