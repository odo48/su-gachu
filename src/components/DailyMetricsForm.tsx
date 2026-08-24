'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

// needsWeekSync: lipsesc zile din ultima săptămână în DB → backfill la mount
export default function DailyMetricsForm({
  hasGarminToday = false,
  needsWeekSync = false,
}: {
  hasGarminToday?: boolean;
  needsWeekSync?: boolean;
}) {
  const router   = useRouter();
  const supabase = createClient();

  const [weight,     setWeight]     = useState('');
  const [steps,      setSteps]      = useState('');
  const [activeKcal, setActiveKcal] = useState('');
  const [sleep,      setSleep]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(hasGarminToday ? 'ok' : 'idle');
  const [syncMsg,    setSyncMsg]    = useState('');

  const syncGarmin = useCallback(async (force = false) => {
    setSyncStatus('syncing');
    setSyncMsg('');
    try {
      const qs = force
        ? 'days=7&onlyMissing=false'
        : 'days=7&onlyMissing=true';
      const res  = await fetch(`/api/garmin/sync?${qs}`, { method: 'POST' });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {
        setSyncStatus('error');
        setSyncMsg(`Răspuns invalid de la server: ${text.slice(0, 80) || '(gol)'}`);
        return;
      }
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
      if (m.steps)         parts.push(`${m.steps.toLocaleString()} pași azi`);
      if (m.resting_hr)    parts.push(`HR ${m.resting_hr} bpm`);
      if (m.sleep_minutes) parts.push(`${Math.round(m.sleep_minutes / 60 * 10) / 10}h somn`);
      if (m.hrv)           parts.push(`HRV ${m.hrv}ms`);
      if (m.weight_kg)     parts.push(`${m.weight_kg}kg`);
      if (data.failed?.length) {
        parts.push(`${data.failed.length} zile fără date Garmin`);
      }
      setSyncStatus('ok');
      setSyncMsg(parts.length ? parts.join(' · ') : 'Date sincronizate.');
      router.refresh();
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMsg(e?.message ?? 'Brain inaccesibil');
    }
  }, [router]);

  // Backfill ultima săptămână dacă lipsesc zile; altfel doar când lipsește azi
  useEffect(() => {
    if (needsWeekSync || !hasGarminToday) syncGarmin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('daily_metrics').upsert({
      user_id:       user.id,
      date:          new Date().toISOString().slice(0, 10),
      source:        'manual',
      weight_kg:     weight     ? Number(weight)               : null,
      steps:         steps      ? Number(steps)                : null,
      active_kcal:   activeKcal ? Number(activeKcal)           : null,
      sleep_minutes: sleep      ? Math.round(Number(sleep)*60) : null,
    }, { onConflict: 'user_id,date,source' });
    if (weight) {
      await supabase.from('profiles').update({ weight_kg: Number(weight) }).eq('id', user.id);
    }
    setSaving(false);
    router.refresh();
  }

  const f = 'input';

  return (
    <div className="space-y-3">
      {/* Garmin status — auto-sync, fără buton */}
      <div className="flex items-center gap-2 text-sm">
        {syncStatus === 'syncing' && (
          <>
            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
            <span className="text-muted-foreground">Se sincronizează cu Garmin...</span>
          </>
        )}
        {syncStatus === 'ok' && (
          <>
            <span className="text-green-500">⌚</span>
            <span className="text-muted-foreground">{syncMsg || 'Garmin sincronizat'}</span>
            <Button variant="ghost" size="sm" onClick={() => syncGarmin(true)} className="ml-auto h-7 text-xs">
              ↻ reîncarcă
            </Button>
          </>
        )}
        {syncStatus === 'error' && (
          <>
            <span className="text-red-400">⌚</span>
            <span className="text-red-400 text-xs">{syncMsg}</span>
            <Button variant="link" size="sm" onClick={() => syncGarmin(true)} className="ml-auto h-7 text-xs">
              Reîncearcă
            </Button>
          </>
        )}
      </div>

      {/* Manual fallback */}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
          Sau introdu manual
        </summary>
        <form onSubmit={save} className="mt-2 grid grid-cols-2 gap-3">
          <input className={f} type="number" step="0.1" placeholder="Greutate azi (kg)"
            value={weight}     onChange={e => setWeight(e.target.value)} />
          <input className={f} type="number" placeholder="Pași"
            value={steps}      onChange={e => setSteps(e.target.value)} />
          <input className={f} type="number" placeholder="Kcal active"
            value={activeKcal} onChange={e => setActiveKcal(e.target.value)} />
          <input className={f} type="number" step="0.1" placeholder="Somn (ore)"
            value={sleep}      onChange={e => setSleep(e.target.value)} />
          <Button type="submit" disabled={saving} variant="secondary" className="col-span-2 w-full">
            {saving ? 'Salvez...' : 'Salvează manual'}
          </Button>
        </form>
      </details>
    </div>
  );
}
