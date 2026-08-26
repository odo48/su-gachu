'use client';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
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

type Aspsp = { name: string; country: string };

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'RO', label: 'România' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'HU', label: 'Ungaria' },
  { code: 'PL', label: 'Polonia' },
  { code: 'DE', label: 'Germania' },
  { code: 'AT', label: 'Austria' },
  { code: 'IT', label: 'Italia' },
  { code: 'ES', label: 'Spania' },
  { code: 'FR', label: 'Franța' },
  { code: 'NL', label: 'Țările de Jos' },
  { code: 'BE', label: 'Belgia' },
  { code: 'PT', label: 'Portugalia' },
  { code: 'IE', label: 'Irlanda' },
  { code: 'FI', label: 'Finlandă' },
  { code: 'EE', label: 'Estonia' },
  { code: 'LV', label: 'Letonia' },
  { code: 'LT', label: 'Lituania' },
  { code: 'SE', label: 'Suedia' },
  { code: 'DK', label: 'Danemarca' },
  { code: 'NO', label: 'Norvegia' },
  { code: 'CZ', label: 'Cehia' },
  { code: 'SK', label: 'Slovacia' },
  { code: 'GR', label: 'Grecia' },
  { code: 'HR', label: 'Croația' },
];

const selectClass =
  'flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

const textareaClass =
  'min-h-36 w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

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
  const [country, setCountry] = useState('RO');
  const [psuType, setPsuType] = useState<'personal' | 'business'>('personal');
  const [banks, setBanks] = useState<Aspsp[]>([]);
  const [bankName, setBankName] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);
  const [appId, setAppId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [editingCreds, setEditingCreds] = useState(false);
  const [callbackUrls, setCallbackUrls] = useState<string[]>([]);
  const [httpBlocked, setHttpBlocked] = useState(false);

  async function refresh() {
    const [accountsRes, connRes] = await Promise.all([
      fetch('/api/financial/accounts'),
      fetch('/api/enable-banking/connection'),
    ]);
    const accountsData = await accountsRes.json().catch(() => []);
    const conn = await connRes.json().catch(() => ({}));
    setAccounts(Array.isArray(accountsData) ? accountsData : []);
    const isConfigured = !!conn.configured;
    setConfigured(isConfigured);
    setSavedAppId(typeof conn.appId === 'string' ? conn.appId : null);
    if (isConfigured && typeof conn.appId === 'string') setAppId(conn.appId);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
    const prod = 'https://su-gachu.vercel.app/api/enable-banking/callback';
    const origin = window.location.origin.replace(/\/$/, '');
    const isHttp = window.location.protocol === 'http:';
    const localHttps = isHttp
      ? `https://${window.location.host}/api/enable-banking/callback`
      : `${origin}/api/enable-banking/callback`;
    setHttpBlocked(isHttp);
    setCallbackUrls([...new Set([localHttps, prod])]);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const banking = params.get('banking');
    if (!banking) return;
    const messages: Record<string, string> = {
      ok: 'Banca e conectată. Soldurile s-au sincronizat.',
      denied: 'Conectarea a fost anulată la bancă.',
      empty: 'Banca nu a returnat niciun cont.',
      error: 'Nu am putut finaliza conectarea. Încearcă din nou.',
    };
    setMsg(messages[banking] ?? messages.error);
    params.delete('banking');
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);

  useEffect(() => {
    if (!configured) {
      setBanks([]);
      setLoadingBanks(false);
      return;
    }
    let cancelled = false;
    async function loadBanks() {
      setLoadingBanks(true);
      setBanksError(null);
      setBankName('');
      const res = await fetch(
        `/api/enable-banking/aspsps?country=${encodeURIComponent(country)}&psu_type=${psuType}`
      );
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoadingBanks(false);
      if (!res.ok) {
        setBanks([]);
        setBanksError(data.error ?? 'Nu am putut încărca lista de bănci.');
        return;
      }
      setBanks(Array.isArray(data.aspsps) ? data.aspsps : []);
    }
    loadBanks();
    return () => {
      cancelled = true;
    };
  }, [country, psuType, configured]);

  async function saveCreds(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/enable-banking/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, privateKey }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setPrivateKey('');
    setEditingCreds(false);
    setMsg('Datele Enable Banking sunt salvate. Poți conecta banca.');
    await refresh();
  }

  async function removeCreds() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/enable-banking/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut șterge datele.');
      return;
    }
    setConfigured(false);
    setSavedAppId(null);
    setAppId('');
    setPrivateKey('');
    setEditingCreds(false);
    setBanks([]);
    setMsg('Datele Enable Banking au fost scoase.');
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/enable-banking/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country, name: bankName, psuType, origin: window.location.origin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    if (typeof data.url !== 'string') {
      setLoading(false);
      setMsg('Nu am primit URL-ul de conectare.');
      return;
    }
    window.location.href = data.url;
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
    setMsg(
      `${data.synced ?? 0} conturi cu tranzacții sincronizate${data.failed ? ` · ${data.failed} eșuate` : ''}.`
    );
  }

  const busy = loading || syncing;
  const showCredsForm = !configured || editingCreds;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Bancă</h2>
        <p className="text-sm text-muted-foreground">
          Fiecare user își pune App ID + cheia PEM din Enable Banking Control Panel, apoi își conectează banca. Nimic
          în env.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : (
          <>
            {configured && !editingCreds && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="min-w-0 truncate text-sm">
                  Aplicație: <span className="font-medium">{savedAppId}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditingCreds(true)}>
                    Schimbă
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={removeCreds}>
                    Scoate cheia
                  </Button>
                </div>
              </div>
            )}

            {showCredsForm && (
              <form onSubmit={saveCreds} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="eb-app-id">App ID</Label>
                  <Input
                    id="eb-app-id"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="uuid din Control Panel"
                    required
                    autoComplete="off"
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-pem">Cheie privată (PEM)</Label>
                  <textarea
                    id="eb-pem"
                    className={textareaClass}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    required
                    disabled={busy}
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy} className="flex-1">
                    {loading ? 'Salvez…' : 'Salvează datele'}
                  </Button>
                  {configured && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setEditingCreds(false)}>
                      Anulează
                    </Button>
                  )}
                </div>
              </form>
            )}

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
                        {a.balance.toLocaleString('ro-RO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.iban}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
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
                <Button type="button" disabled={busy || !configured} onClick={syncBalances}>
                  {syncing ? 'Sincronizez…' : 'Sincronizează solduri'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !configured}
                  onClick={syncTransactions}
                >
                  Tranzacții (30 zile)
                </Button>
              </div>
            )}

            {configured && callbackUrls.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
                <p className="text-sm text-muted-foreground">
                  Enable Banking acceptă doar <span className="font-medium text-foreground">https://</span>, nu
                  http://localhost. În Control Panel → Redirect URLs:
                </p>
                {callbackUrls.map((url) => (
                  <div key={url} className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all text-xs text-foreground">{url}</code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        await navigator.clipboard.writeText(url);
                        setMsg('URL copiat. Lipește-l la Redirect URLs în Control Panel.');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copiază
                    </Button>
                  </div>
                ))}
                {httpBlocked && (
                  <p className="text-sm text-muted-foreground">
                    Ești pe HTTP, deci conectarea locală e blocată. Folosește{' '}
                    <a
                      className="underline"
                      href="https://su-gachu.vercel.app/dashboard"
                    >
                      su-gachu.vercel.app
                    </a>{' '}
                    sau pornește <code className="text-xs">npm run dev:https</code>.
                  </p>
                )}
              </div>
            )}

            {configured && (
              <form onSubmit={connect} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="eb-country">Țară</Label>
                    <select
                      id="eb-country"
                      className={selectClass}
                      value={country}
                      disabled={busy || loadingBanks}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eb-psu">Tip cont</Label>
                    <select
                      id="eb-psu"
                      className={selectClass}
                      value={psuType}
                      disabled={busy || loadingBanks}
                      onChange={(e) => setPsuType(e.target.value as 'personal' | 'business')}
                    >
                      <option value="personal">Personal</option>
                      <option value="business">Firmă</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eb-bank">Bancă</Label>
                  <select
                    id="eb-bank"
                    className={selectClass}
                    value={bankName}
                    disabled={busy || loadingBanks || !!banksError || banks.length === 0}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                  >
                    <option value="">
                      {loadingBanks ? 'Încarc băncile…' : banks.length === 0 ? 'Nicio bancă' : 'Alege banca'}
                    </option>
                    {banks.map((b) => (
                      <option key={`${b.country}-${b.name}`} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={busy || loadingBanks || !bankName || httpBlocked} className="w-full">
                  {httpBlocked ? 'Doar pe HTTPS' : loading ? 'Te duc la bancă…' : 'Conectează banca'}
                </Button>
              </form>
            )}
          </>
        )}
        {(msg || banksError) && (
          <p className="text-sm text-muted-foreground" role="status">
            {banksError ?? msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
