'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function HomeAssistantConnectForm() {
  const [mcpUrl, setMcpUrl] = useState('');
  const [token, setToken] = useState('');
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/home-assistant/connection');
    const data = await res.json().catch(() => ({}));
    setConnectedUrl(data.connected ? data.mcpUrl : null);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/home-assistant/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpUrl, token }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setToken('');
    setMsg('Home Assistant conectat.');
    await refresh();
  }

  async function disconnect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/home-assistant/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut deconecta.');
      return;
    }
    setConnectedUrl(null);
    setMsg('Home Assistant deconectat.');
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Home Assistant</h2>
        <p className="text-sm text-muted-foreground">
          URL-ul MCP al instanței tale + un long-lived access token. Independent de Garmin, inel și bancă.
        </p>
      </CardHeader>
      <CardContent>
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : connectedUrl ? (
          <div className="space-y-3">
            <p className="break-all text-sm">
              Conectat: <span className="font-medium">{connectedUrl}</span>
            </p>
            <Button type="button" variant="outline" disabled={loading} onClick={disconnect}>
              {loading ? 'Se deconectează…' : 'Deconectează Home Assistant'}
            </Button>
          </div>
        ) : (
          <form onSubmit={connect} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ha-mcp">URL MCP</Label>
              <Input
                id="ha-mcp"
                type="url"
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ha-token">Long-lived token</Label>
              <Input
                id="ha-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Se conectează…' : 'Conectează Home Assistant'}
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
