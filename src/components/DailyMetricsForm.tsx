'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Introducere manuală a metricilor zilei (până conectezi Garmin).
export default function DailyMetricsForm() {
  const router = useRouter();
  const supabase = createClient();
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [activeKcal, setActiveKcal] = useState('');
  const [sleep, setSleep] = useState('');
  const [saving, setSaving] = useState(false);

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
    // sincronizează și greutatea în profil
    if (weight) await supabase.from('profiles').update({ weight_kg: Number(weight) }).eq('id', user.id);
    setSaving(false);
    router.refresh();
  }

  const f = 'rounded border p-2 w-full';
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3">
      <input className={f} type="number" step="0.1" placeholder="Greutate azi (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <input className={f} type="number" placeholder="Pași" value={steps} onChange={(e) => setSteps(e.target.value)} />
      <input className={f} type="number" placeholder="Calorii arse activ" value={activeKcal} onChange={(e) => setActiveKcal(e.target.value)} />
      <input className={f} type="number" step="0.1" placeholder="Somn (ore)" value={sleep} onChange={(e) => setSleep(e.target.value)} />
      <button disabled={saving} className="col-span-2 rounded border border-brand py-2 font-medium text-brand hover:bg-green-50 disabled:opacity-50">
        {saving ? 'Salvez...' : 'Salvează metricile zilei'}
      </button>
    </form>
  );
}
