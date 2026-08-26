'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DailyMetricsForm({ garminConnected = false }: { garminConnected?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [activeKcal, setActiveKcal] = useState('');
  const [sleep, setSleep] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('daily_metrics').upsert({
      user_id: user.id,
      date: new Date().toISOString().slice(0, 10),
      source: 'manual',
      weight_kg: weight ? Number(weight) : null,
      steps: steps ? Number(steps) : null,
      active_kcal: activeKcal ? Number(activeKcal) : null,
      sleep_minutes: sleep ? Number(sleep) * 60 : null,
    }, { onConflict: 'user_id,date,source' });
    if (weight) await supabase.from('profiles').update({ weight_kg: Number(weight) }).eq('id', user.id);
    setSaving(false);
    router.refresh();
  }

  async function syncGarmin() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch('/api/garmin/sync?days=7&onlyMissing=false', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setSyncMsg(data.error ?? `HTTP ${res.status}`);
      return;
    }
    const parts: string[] = [];
    if (data.skipped) parts.push('Săptămâna e la zi');
    else if (data.synced > 0) parts.push(`${data.synced} ${data.synced === 1 ? 'zi' : 'zile'} din Garmin`);
    if (data.failed?.length) parts.push(`${data.failed.length} zile fără date`);
    setSyncMsg(parts.join(' · ') || 'Sincronizat.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {garminConnected ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={syncGarmin} disabled={syncing}>
            {syncing ? 'Sincronizez Garmin…' : 'Sincronizează Garmin'}
          </Button>
          {syncMsg && <p className="text-sm text-muted-foreground">{syncMsg}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/profile" className="underline">Conectează Garmin</Link> pe profil ca să tragi pașii, somnul și HR automat.
        </p>
      )}
      <form onSubmit={save} className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="weight">Greutate azi (kg)</Label>
          <Input id="weight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="steps">Pași</Label>
          <Input id="steps" type="number" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kcal">Calorii arse activ</Label>
          <Input id="kcal" type="number" value={activeKcal} onChange={(e) => setActiveKcal(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sleep">Somn (ore)</Label>
          <Input id="sleep" type="number" step="0.1" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={saving} className="col-span-2">
          {saving ? 'Salvez...' : 'Salvează metricile zilei'}
        </Button>
      </form>
    </div>
  );
}
