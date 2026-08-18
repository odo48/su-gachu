import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import WeightChart from '@/components/WeightChart';
import RecommendButton from '@/components/RecommendButton';
import DailyMetricsForm from '@/components/DailyMetricsForm';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profileReady = profile?.birth_date && profile?.height_cm && profile?.weight_kg;

  const today = new Date().toISOString().slice(0, 10);
  const { data: rec } = await supabase
    .from('recommendations').select('*')
    .eq('user_id', user.id).eq('date', today)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  const { data: history } = await supabase
    .from('daily_metrics').select('date, weight_kg')
    .eq('user_id', user.id).not('weight_kg', 'is', null)
    .order('date', { ascending: true }).limit(60);

  const chart = (history ?? []).map((h) => ({ date: h.date.slice(5), weight: Number(h.weight_kg) }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Astăzi</h1>
        <div className="flex gap-4">
          <Link href="/chat" className="text-sm text-brand underline">Chat</Link>
          <Link href="/profile" className="text-sm text-brand underline">Profil</Link>
        </div>
      </div>

      {!profileReady && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          Completează-ți <Link href="/profile" className="underline">profilul</Link> (greutate, înălțime, dată naștere) ca să pot genera planul.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Greutate</h2>
        <WeightChart data={chart} target={profile?.target_weight_kg} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Metricile zilei</h2>
        <DailyMetricsForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Planul zilei</h2>
          {profileReady && <RecommendButton />}
        </div>

        {rec ? (
          <div className="space-y-4 rounded border bg-white p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['kcal', rec.target_calories], ['Proteină', `${rec.target_protein_g}g`],
                ['Carbo', `${rec.target_carbs_g}g`], ['Grăsimi', `${rec.target_fat_g}g`]].map(([k, v]) => (
                <div key={k as string} className="rounded bg-neutral-100 p-2">
                  <div className="text-lg font-bold">{v as any}</div>
                  <div className="text-xs text-neutral-500">{k}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-neutral-700">{rec.rationale}</p>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Mese sugerate</h3>
              <ul className="space-y-1 text-sm">
                {(rec.suggested_meals as any[])?.map((m, i) => (
                  <li key={i} className="flex justify-between rounded bg-neutral-50 px-3 py-1">
                    <span>{m.name}</span>
                    <span className="text-neutral-400">{m.slot}</span>
                  </li>
                ))}
              </ul>
            </div>
            {rec.training && (
              <div className="rounded bg-green-50 p-3 text-sm">
                <strong>Antrenament:</strong> {(rec.training as any).focus} · {(rec.training as any).cardio_minutes} min cardio
                <p className="text-neutral-600">{(rec.training as any).notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Niciun plan azi. Apasă „Generează planul zilei".</p>
        )}
      </section>
    </div>
  );
}
