import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import GarminConnectForm from '@/components/GarminConnectForm';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  async function save(formData: FormData) {
    'use server';
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const num = (k: string) => {
      const v = formData.get(k);
      return v === null || v === '' ? null : Number(v);
    };
    await supabase.from('profiles').update({
      full_name: formData.get('full_name') as string,
      sex: formData.get('sex') as string,
      birth_date: (formData.get('birth_date') as string) || null,
      height_cm: num('height_cm'),
      weight_kg: num('weight_kg'),
      target_weight_kg: num('target_weight_kg'),
      activity_level: formData.get('activity_level') as string,
      goal: formData.get('goal') as string,
      manual_calorie_cap: num('manual_calorie_cap'),
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    revalidatePath('/dashboard');
    redirect('/dashboard');
  }

  const field = 'w-full rounded border p-2';
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profil</h1>
        <Link href="/dashboard" className="text-sm text-brand underline">Dashboard →</Link>
      </div>
      <form action={save} className="space-y-4">
        <input name="full_name" className={field} placeholder="Nume" defaultValue={p?.full_name ?? ''} />
        <div className="grid grid-cols-2 gap-3">
          <select name="sex" className={field} defaultValue={p?.sex ?? 'male'}>
            <option value="male">Bărbat</option>
            <option value="female">Femeie</option>
          </select>
          <input name="birth_date" type="date" className={field} defaultValue={p?.birth_date ?? ''} />
          <input name="height_cm" type="number" step="0.1" className={field} placeholder="Înălțime (cm)" defaultValue={p?.height_cm ?? ''} />
          <input name="weight_kg" type="number" step="0.1" className={field} placeholder="Greutate (kg)" defaultValue={p?.weight_kg ?? ''} />
          <input name="target_weight_kg" type="number" step="0.1" className={field} placeholder="Greutate țintă (kg)" defaultValue={p?.target_weight_kg ?? ''} />
          <input name="manual_calorie_cap" type="number" className={field} placeholder="Cap calorii (ex: 1500)" defaultValue={p?.manual_calorie_cap ?? ''} />
        </div>
        <select name="activity_level" className={field} defaultValue={p?.activity_level ?? 'active'}>
          <option value="sedentary">Sedentar</option>
          <option value="light">Ușor activ</option>
          <option value="moderate">Moderat</option>
          <option value="active">Activ (sport 3-4x/săpt)</option>
          <option value="very_active">Foarte activ</option>
        </select>
        <select name="goal" className={field} defaultValue={p?.goal ?? 'fat_loss'}>
          <option value="fat_loss">Slăbit</option>
          <option value="recomposition">Recompoziție</option>
          <option value="muscle_gain">Masă musculară</option>
          <option value="maintenance">Mentenanță</option>
        </select>
        <button className="w-full rounded bg-brand py-2 font-medium text-white hover:bg-brand-dark">
          Salvează
        </button>
      </form>
      <div className="mt-8">
        <GarminConnectForm />
      </div>
    </div>
  );
}
