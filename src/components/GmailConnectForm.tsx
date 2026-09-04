'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Simple OAuth connect/disconnect + on-demand sync — no secret entry needed
// (Gmail uses the app-wide OAuth client, see lib/gmail/client.ts), unlike
// BankingConnectForm's per-user App ID + PEM.
export default function GmailConnectForm() {
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/gmail/connection');
    const data = await res.json().catch(() => ({}));
    setEmailAddress(data.connected ? data.emailAddress : null);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    const status = params.get('gmail');
    if (status === 'ok') setMsg('Gmail conectat.');
    else if (status === 'denied') setMsg('Conectarea Gmail a fost anulată.');
    else if (status === 'error') setMsg('Conectarea Gmail a eșuat.');
  }, []);

  async function connect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/gmail/connect', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !data.url) {
      setMsg(data.error ?? 'Nu am putut porni conectarea Gmail.');
      return;
    }
    window.location.href = data.url;
  }

  async function disconnect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/gmail/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut deconecta Gmail.');
      return;
    }
    setEmailAddress(null);
    setMsg('Gmail deconectat.');
  }

  async function sync() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch('/api/gmail/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setMsg(data.error ?? 'Sincronizarea Gmail a eșuat.');
      return;
    }
    setMsg(
      `${data.ingested ?? 0} email-uri noi · ${data.analyzed ?? 0} analizate · ${data.signalsRaised ?? 0} alerte noi${
        data.remaining > 0 ? ` · ${data.remaining} rămase, apasă din nou` : ''
      }.`
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Gmail</h2>
        <p className="text-sm text-muted-foreground">
          Detectează rambursări promise și perioade de probă care expiră, din email-uri de chitanță.
        </p>
      </CardHeader>
      <CardContent>
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : emailAddress ? (
          <div className="space-y-3">
            <p className="text-sm">
              Conectat: <span className="font-medium">{emailAddress}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={syncing} onClick={sync}>
                <RefreshCw className="h-4 w-4" />
                {syncing ? 'Sincronizez…' : 'Sincronizează'}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={disconnect}>
                {loading ? 'Se deconectează…' : 'Deconectează Gmail'}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" disabled={loading} onClick={connect}>
            <Mail className="h-4 w-4" />
            {loading ? 'Se conectează…' : 'Conectează Gmail'}
          </Button>
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
