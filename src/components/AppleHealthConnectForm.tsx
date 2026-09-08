'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// iCloud link of the finished Shortcut if configured; otherwise the
// best-effort skeleton committed under public/ (see docs/apple-health-shortcut.md).
const SHORTCUT_URL =
  process.env.NEXT_PUBLIC_APPLE_HEALTH_SHORTCUT_URL || '/shortcuts/su-gachu-health-sync.shortcut';

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copiază ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable — the field is selectable */
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function AppleHealthConnectForm() {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<{ token: string; ingestUrl: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/apple-health/connection');
    const data = await res.json().catch(() => ({}));
    setConnected(!!data.connected);
    setDeviceName(data.deviceName ?? null);
    setLastSyncedAt(data.lastSyncedAt ?? null);
    setChecking(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function issueToken(regenerate = false) {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/apple-health/connection', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    setCreds({ token: data.token, ingestUrl: data.ingestUrl });
    setMsg(
      regenerate
        ? 'Token nou generat. Actualizează-l în shortcut — cel vechi nu mai funcționează.'
        : 'Apple Watch conectat. Configurează shortcut-ul mai jos.'
    );
    await refresh();
  }

  async function disconnect() {
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/apple-health/connection', { method: 'DELETE' });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? 'Nu am putut deconecta.');
      return;
    }
    setConnected(false);
    setCreds(null);
    setMsg('Apple Watch deconectat. Garmin și Ultrahuman rămân neschimbate.');
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-xl font-semibold tracking-tight">Apple Watch</h2>
        <p className="text-sm text-muted-foreground">
          Fără app nativ: instalezi un shortcut pe iPhone care trimite datele ceasului. Îl pornești
          cu butonul „Sincronizează Apple Watch" din Dashboard.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {checking ? (
          <p className="text-sm text-muted-foreground">Verific conexiunea…</p>
        ) : (
          <>
            {connected ? (
              <div className="space-y-1 text-sm">
                <p>Apple Watch conectat{deviceName ? ` — ${deviceName}` : ''}.</p>
                {lastSyncedAt && (
                  <p className="text-muted-foreground">
                    Ultima sincronizare: {new Date(lastSyncedAt).toLocaleString('ro-RO')}
                  </p>
                )}
              </div>
            ) : (
              <Button type="button" disabled={loading} onClick={() => issueToken(false)}>
                {loading ? 'Se conectează…' : 'Conectează Apple Watch'}
              </Button>
            )}

            {(connected || creds) && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Configurare shortcut (o singură dată)</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <a href={SHORTCUT_URL} className="text-primary underline" target="_blank" rel="noreferrer">
                      Adaugă shortcut-ul „Su Gachu Health Sync"
                    </a>{' '}
                    (pe iPhone).
                  </li>
                  <li>Deschide shortcut-ul → editează cele două câmpuri Text din cap cu valorile de mai jos.</li>
                  <li>Rulează-l o dată și acceptă accesul la Sănătate.</li>
                </ol>

                {creds ? (
                  <div className="space-y-3">
                    <CopyField label="INGEST_URL" value={creds.ingestUrl} />
                    <CopyField label="TOKEN" value={creds.token} />
                    <p className="text-xs text-muted-foreground">
                      Token-ul se afișează o singură dată. Salvează-l în shortcut acum.
                    </p>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => issueToken(true)}>
                    {loading ? 'Generez…' : 'Regenerează token'}
                  </Button>
                )}
              </div>
            )}

            {connected && (
              <Button type="button" variant="outline" disabled={loading} onClick={disconnect}>
                {loading ? 'Se deconectează…' : 'Deconectează Apple Watch'}
              </Button>
            )}
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
