'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleDashed, Loader2, Pencil, Watch } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isoDateLocal } from '@/lib/garmin/dates';
import { upsertCommonBiometrics } from '@/lib/biometrics/translate';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export default function DailyMetricsForm({
  garminConnected = false,
  hasGarminToday = false,
  needsWeekSync = false,
  ultrahumanConnected = false,
}: {
  garminConnected?: boolean;
  hasGarminToday?: boolean;
  needsWeekSync?: boolean;
  ultrahumanConnected?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showManual, setShowManual] = useState(false);
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [activeKcal, setActiveKcal] = useState('');
  const [sleep, setSleep] = useState('');
  const [saving, setSaving] = useState(false);
  const [garminStatus, setGarminStatus] = useState<SyncStatus>(
    garminConnected && hasGarminToday ? 'ok' : 'idle'
  );
  const [garminMsg, setGarminMsg] = useState('');
  const [ultrahumanStatus, setUltrahumanStatus] = useState<SyncStatus>('idle');
  const [ultrahumanMsg, setUltrahumanMsg] = useState('');

  const syncGarmin = useCallback(
    async (force = false) => {
      setGarminStatus('syncing');
      setGarminMsg('');
      try {
        const qs = force ? 'days=7&onlyMissing=false' : 'days=7&onlyMissing=true';
        const res = await fetch(`/api/garmin/sync?${qs}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || data.saved === false) {
          setGarminStatus('error');
          setGarminMsg(data.error ?? `HTTP ${res.status}`);
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
        setGarminStatus('ok');
        setGarminMsg(parts.length ? parts.join(' · ') : 'Date sincronizate.');
        router.refresh();
      } catch (e: unknown) {
        setGarminStatus('error');
        setGarminMsg(e instanceof Error ? e.message : 'Sincronizarea a eșuat');
      }
    },
    [router]
  );

  const syncUltrahuman = useCallback(async () => {
    setUltrahumanStatus('syncing');
    setUltrahumanMsg('');
    try {
      const res = await fetch('/api/biometrics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setUltrahumanStatus('error');
        setUltrahumanMsg(data.error ?? data.message ?? `HTTP ${res.status}`);
        return;
      }
      setUltrahumanStatus('ok');
      setUltrahumanMsg(data.message ?? (data.skipped ? 'Datele de azi sunt deja acolo.' : 'Ultrahuman sincronizat.'));
      router.refresh();
    } catch (e: unknown) {
      setUltrahumanStatus('error');
      setUltrahumanMsg(e instanceof Error ? e.message : 'Sincronizarea a eșuat');
    }
  }, [router]);

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
    await upsertCommonBiometrics(
      supabase,
      user.id,
      isoDateLocal(),
      {
        weight_kg: weightKg,
        steps: n(steps, 0, 200_000),
        active_kcal: n(activeKcal, 0, 20_000),
        sleep_minutes: sleep ? Math.round((n(sleep, 0, 24) ?? 0) * 60) : null,
      },
      'manual'
    );
    if (weightKg) await supabase.from('profiles').update({ weight_kg: weightKg }).eq('id', user.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowManual((v) => !v)}>
          <Pencil /> Introdu manual
        </Button>

        {ultrahumanConnected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ultrahumanStatus === 'syncing'}
            onClick={syncUltrahuman}
          >
            {ultrahumanStatus === 'syncing' ? <Loader2 className="animate-spin" /> : <CircleDashed />}
            Sincronizează Ultrahuman
          </Button>
        ) : (
          <Link href="/profile" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <CircleDashed /> Conectează Ultrahuman
          </Link>
        )}

        {garminConnected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={garminStatus === 'syncing'}
            onClick={() => syncGarmin(true)}
          >
            {garminStatus === 'syncing' ? <Loader2 className="animate-spin" /> : <Watch />}
            Sincronizează Garmin
          </Button>
        ) : (
          <Link href="/profile" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Watch /> Conectează Garmin
          </Link>
        )}
      </div>

      {(ultrahumanMsg || garminMsg) && (
        <div className="space-y-0.5 text-xs">
          {ultrahumanMsg && (
            <p className={ultrahumanStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
              Ultrahuman: {ultrahumanMsg}
            </p>
          )}
          {garminMsg && (
            <p className={garminStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
              Garmin: {garminMsg}
            </p>
          )}
        </div>
      )}

      {showManual && (
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
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
      )}
    </div>
  );
}
