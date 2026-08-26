'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UltrahumanConnectForm() {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/biometrics/connection');
    const data = await res.json().catch(() => ({}));
    setConnected(!!data.connected);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/biometrics/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setToken('');
    setMsg('Ultrahuman conectat. Poți sincroniza datele inelului.');
    await refresh();
  }

  async function disconnect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/biometrics/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut deconecta.');
      return;
    }
    setConnected(false);
    setMsg('Ultrahuman deconectat. Garmin rămâne neschimbat.');
  }

  async function syncToday() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch('/api/biometrics/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setMsg(data.error ?? data.message ?? `HTTP ${res.status}`);
      return;
    }
    setMsg(data.message ?? (data.skipped ? 'Datele de azi sunt deja acolo.' : 'Ultrahuman sincronizat.'));
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Ultrahuman</h2>
        <p className="text-sm text-muted-foreground">
          Token Partner API pentru inel. Independent de Garmin — poți avea ambele conectate.
        </p>
      </CardHeader>
      <CardContent>
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : connected ? (
          <div className="space-y-3">
            <p className="text-sm">Inel Ultrahuman conectat.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={syncing || loading} onClick={syncToday}>
                {syncing ? 'Sincronizez…' : 'Sincronizează azi'}
              </Button>
              <Button type="button" variant="outline" disabled={loading || syncing} onClick={disconnect}>
                {loading ? 'Se deconectează…' : 'Deconectează Ultrahuman'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={connect} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="uh-token">Token Ultrahuman</Label>
              <Input
                id="uh-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Se conectează…' : 'Conectează Ultrahuman'}
            </Button>
          </form>
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
