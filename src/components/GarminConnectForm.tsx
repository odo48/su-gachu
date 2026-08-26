'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GarminConnectForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/garmin/connection');
    const data = await res.json().catch(() => ({}));
    setConnectedEmail(data.connected ? data.email : null);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/garmin/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setPassword('');
    setMsg('Garmin conectat. Poți sincroniza de pe dashboard.');
    await refresh();
  }

  async function disconnect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/garmin/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut deconecta.');
      return;
    }
    setConnectedEmail(null);
    setMsg('Garmin deconectat.');
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Garmin Connect</h2>
        <p className="text-sm text-muted-foreground">
          Același login ca în Garmin Connect (email + parolă). Datele se trag direct în app, fără jarvis-brain.
        </p>
      </CardHeader>
      <CardContent>
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : connectedEmail ? (
          <div className="space-y-3">
            <p className="text-sm">
              Conectat ca <span className="font-medium">{connectedEmail}</span>
            </p>
            <Button type="button" variant="outline" disabled={loading} onClick={disconnect}>
              {loading ? 'Se deconectează…' : 'Deconectează Garmin'}
            </Button>
          </div>
        ) : (
          <form onSubmit={connect} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="garmin-email">Email Garmin</Label>
              <Input
                id="garmin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garmin-password">Parolă Garmin</Label>
              <Input
                id="garmin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Se conectează…' : 'Conectează Garmin'}
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
