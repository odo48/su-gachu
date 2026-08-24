import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { error: errorMsg } = await searchParams;

  async function save(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const num = (k: string) => {
      const v = formData.get(k);
      return v === null || v === '' ? null : Number(v);
    };
    const str = (k: string) => {
      const v = formData.get(k) as string;
      return v === '' ? null : v;
    };

    // Sports: checkboxes trimise ca valori multiple cu același name
    const sportsRaw = formData.getAll('sports') as string[];
    const sports = sportsRaw.length > 0 ? sportsRaw : null;

    const { error } = await supabase.from('profiles').upsert({
      id:                user.id,
      full_name:         str('full_name'),
      sex:               str('sex'),
      birth_date:        str('birth_date'),
      height_cm:         num('height_cm'),
      weight_kg:         num('weight_kg'),
      target_weight_kg:  num('target_weight_kg'),
      activity_level:    str('activity_level'),
      goal:              str('goal'),
      manual_calorie_cap: num('manual_calorie_cap'),
      sports,
    }, { onConflict: 'id' });

    if (error) {
      redirect(`/profile?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath('/dashboard');
    revalidatePath('/profile');
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Profil</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">Dashboard →</Link>
        </Button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Eroare la salvare: {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date personale</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-4">
            <input name="full_name" className="input" placeholder="Nume complet"
              defaultValue={p?.full_name ?? ''} />

            <div className="grid grid-cols-2 gap-3">
              <select name="sex" className="input" defaultValue={p?.sex ?? 'male'}>
                <option value="male">Bărbat</option>
                <option value="female">Femeie</option>
              </select>

              <input name="birth_date" type="date" className="input"
                defaultValue={p?.birth_date ?? ''} />

              <input name="height_cm" type="number" step="0.1" className="input"
                placeholder="Înălțime (cm)" defaultValue={p?.height_cm ?? ''} />

              <input name="weight_kg" type="number" step="0.1" className="input"
                placeholder="Greutate actuală (kg)" defaultValue={p?.weight_kg ?? ''} />

              <input name="target_weight_kg" type="number" step="0.1" className="input"
                placeholder="Greutate țintă (kg)" defaultValue={p?.target_weight_kg ?? ''} />

              <input name="manual_calorie_cap" type="number" className="input"
                placeholder="Cap calorii (ex: 1500)" defaultValue={p?.manual_calorie_cap ?? ''} />
            </div>

            <select name="activity_level" className="input" defaultValue={p?.activity_level ?? 'active'}>
              <option value="sedentary">Sedentar</option>
              <option value="light">Ușor activ</option>
              <option value="moderate">Moderat</option>
              <option value="active">Activ (sport 3-4x/săpt)</option>
              <option value="very_active">Foarte activ</option>
            </select>

            <select name="goal" className="input" defaultValue={p?.goal ?? 'fat_loss'}>
              <option value="fat_loss">Slăbit</option>
              <option value="recomposition">Recompoziție</option>
              <option value="muscle_gain">Masă musculară</option>
              <option value="maintenance">Mentenanță</option>
            </select>

            {/* Sporturi practicate */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Sporturi practicate
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'sala',     label: '🏋️ Sală / Fitness' },
                  { value: 'kickbox',  label: '🥊 Kickbox' },
                  { value: 'padel',    label: '🎾 Padel' },
                  { value: 'coarda',   label: '🪢 Coardă' },
                  { value: 'alergare', label: '🏃 Alergare' },
                  { value: 'inot',     label: '🏊 Înot' },
                  { value: 'ciclism',  label: '🚴 Ciclism' },
                  { value: 'fotbal',   label: '⚽ Fotbal' },
                ].map(({ value, label }) => (
                  <label key={value}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950">
                    <input
                      type="checkbox"
                      name="sports"
                      value={value}
                      defaultChecked={(p?.sports as string[] | null)?.includes(value)}
                      className="accent-brand-700"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full">Salvează</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
