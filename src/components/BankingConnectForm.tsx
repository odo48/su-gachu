'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isoDateLocal } from '@/lib/garmin/dates';

type Account = {
  id: number;
  bank: string;
  currencyCode: string;
  balance: number;
  iban: string;
  externalAccountId: string;
};

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDateLocal(d);
}

export default function BankingConnectForm() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState('RON');
  const [iban, setIban] = useState('');

  async function refresh() {
    const res = await fetch('/api/financial/accounts');
    const data = await res.json().catch(() => []);
    setAccounts(Array.isArray(data) ? data : []);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/financial/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, bank, currency, iban }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setAccountId('');
    setBank('');
    setIban('');
    setMsg('Cont adăugat. Sincronizează soldurile și tranzacțiile.');
    await refresh();
  }

  async function removeAccount(id: number) {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/financial/accounts?id=${id}`, { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut șterge contul.');
      return;
    }
    setMsg('Cont scos.');
    await refresh();
  }

  async function syncBalances() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch('/api/financial/accounts/sync-balances', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setMsg(`${data.synced ?? 0} solduri sincronizate${data.failed ? ` · ${data.failed} eșuate` : ''}.`);
    await refresh();
  }

  async function syncTransactions() {
    setSyncing(true);
    setMsg(null);
    const res = await fetch('/api/financial/transactions/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_from: daysAgoIso(30), date_to: isoDateLocal() }),
    });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setMsg(`${data.synced ?? 0} conturi cu tranzacții sincronizate${data.failed ? ` · ${data.failed} eșuate` : ''}.`);
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Enable Banking</h2>
        <p className="text-sm text-muted-foreground">
          Conturi deja legate prin Enable Banking (ID-ul de la PSD2). Chat-ul le folosește pentru solduri și cheltuieli.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conturile…</p>
        ) : (
          <>
            {accounts.length > 0 && (
              <ul className="space-y-2">
                {accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {a.bank} · {a.currencyCode}{' '}
                        {a.balance.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.iban}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading || syncing}
                      onClick={() => removeAccount(a.id)}
                    >
                      Scoate
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {accounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={syncing || loading} onClick={syncBalances}>
                  {syncing ? 'Sincronizez…' : 'Sincronizează solduri'}
                </Button>
                <Button type="button" variant="outline" disabled={syncing || loading} onClick={syncTransactions}>
                  Tranzacții (30 zile)
                </Button>
              </div>
            )}

            <form onSubmit={addAccount} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="eb-account-id">ID cont Enable Banking</Label>
                <Input
                  id="eb-account-id"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="eb-bank">Bancă</Label>
                  <Input id="eb-bank" value={bank} onChange={(e) => setBank(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-currency">Monedă</Label>
                  <Input
                    id="eb-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eb-iban">IBAN</Label>
                <Input id="eb-iban" value={iban} onChange={(e) => setIban(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading || syncing} className="w-full">
                {loading ? 'Salvez…' : 'Adaugă cont'}
              </Button>
            </form>
          </>
        )}
        {msg && (
          <p className="text-sm text-muted-foreground" role="status">
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
