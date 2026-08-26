'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, Watch } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isoDateLocal } from '@/lib/garmin/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export default function DailyMetricsForm({
  garminConnected = false,
  hasGarminToday = false,
  needsWeekSync = false,
}: {
  garminConnected?: boolean;
  hasGarminToday?: boolean;
  needsWeekSync?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [activeKcal, setActiveKcal] = useState('');
  const [sleep, setSleep] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    garminConnected && hasGarminToday ? 'ok' : 'idle'
  );
  const [syncMsg, setSyncMsg] = useState('');

  const syncGarmin = useCallback(
    async (force = false) => {
      setSyncStatus('syncing');
      setSyncMsg('');
      try {
        const qs = force ? 'days=7&onlyMissing=false' : 'days=7&onlyMissing=true';
        const res = await fetch(`/api/garmin/sync?${qs}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || data.saved === false) {
          setSyncStatus('error');
          setSyncMsg(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const m = data.metrics ?? {};
        const parts: string[] = [];
        if (data.synced > 0) {
          parts.push(`${data.synced} ${data.synced === 1 ? 'zi' : 'zile'} din săptămână`);
        } else if (data.skipped) {
          parts.push('Săptămâna e la zi');
        }
        if (m.steps) parts.push(`${Number(m.steps).toLocaleString('ro-RO')} pași azi`);
        if (m.resting_hr) parts.push(`HR ${m.resting_hr} bpm`);
        if (m.sleep_minutes) parts.push(`${Math.round((m.sleep_minutes / 60) * 10) / 10}h somn`);
        if (m.hrv) parts.push(`HRV ${m.hrv}ms`);
        if (m.weight_kg) parts.push(`${m.weight_kg}kg`);
        if (data.failed?.length) parts.push(`${data.failed.length} zile fără date Garmin`);
        setSyncStatus('ok');
        setSyncMsg(parts.length ? parts.join(' · ') : 'Date sincronizate.');
        router.refresh();
      } catch (e: unknown) {
        setSyncStatus('error');
        setSyncMsg(e instanceof Error ? e.message : 'Sincronizarea a eșuat');
      }
    },
    [router]
  );

  useEffect(() => {
    if (!garminConnected) return;
    if (needsWeekSync || !hasGarminToday) syncGarmin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const n = (raw: string, min: number, max: number) => {
      if (!raw) return null;
      const v = Number(raw);
      if (!Number.isFinite(v)) return null;
      return Math.min(max, Math.max(min, v));
    };
    const weightKg = n(weight, 20, 400);
    await supabase.from('daily_metrics').upsert(
      {
        user_id: user.id,
        date: isoDateLocal(),
        source: 'manual',
        weight_kg: weightKg,
        steps: n(steps, 0, 200_000),
        active_kcal: n(activeKcal, 0, 20_000),
        sleep_minutes: sleep ? Math.round((n(sleep, 0, 24) ?? 0) * 60) : null,
      },
      { onConflict: 'user_id,date,source' }
    );
    if (weightKg) await supabase.from('profiles').update({ weight_kg: weightKg }).eq('id', user.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {garminConnected ? (
        <div className="flex items-center gap-2 text-sm">
          {syncStatus === 'syncing' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-secondary" />
              <span className="text-muted-foreground">Se sincronizează cu Garmin...</span>
            </>
          )}
          {syncStatus === 'ok' && (
            <>
              <Watch className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{syncMsg || 'Garmin sincronizat'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => syncGarmin(true)}
                className="ml-auto h-9 text-xs"
              >
                <RefreshCw /> reîncarcă
              </Button>
            </>
          )}
          {syncStatus === 'idle' && (
            <>
              <Watch className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Garmin conectat</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => syncGarmin(true)}
                className="ml-auto h-9 text-xs"
              >
                <RefreshCw /> sincronizează
              </Button>
            </>
          )}
          {syncStatus === 'error' && (
            <>
              <Watch className="h-4 w-4 text-destructive" />
              <span className="text-xs text-destructive">{syncMsg}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => syncGarmin(true)}
                className="ml-auto h-9 text-xs"
              >
                Reîncearcă
              </Button>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/profile" className="underline">
            Conectează Garmin
          </Link>{' '}
          pe profil ca să tragi pașii, somnul și HR automat.
        </p>
      )}

      <details>
        <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
          Sau introdu manual
        </summary>
        <form onSubmit={save} className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="weight">Greutate azi (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="steps">Pași</Label>
            <Input id="steps" type="number" value={steps} onChange={(e) => setSteps(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kcal">Calorii arse activ</Label>
            <Input
              id="kcal"
              type="number"
              value={activeKcal}
              onChange={(e) => setActiveKcal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sleep">Somn (ore)</Label>
            <Input
              id="sleep"
              type="number"
              step="0.1"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={saving} className="col-span-2">
            {saving ? 'Salvez...' : 'Salvează metricile zilei'}
          </Button>
        </form>
      </details>
    </div>
  );
}
