import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseProfileUpdate } from '@/lib/security/profile';
import GarminConnectForm from '@/components/GarminConnectForm';
import UltrahumanConnectForm from '@/components/UltrahumanConnectForm';
import BankingConnectForm from '@/components/BankingConnectForm';
import HomeAssistantConnectForm from '@/components/HomeAssistantConnectForm';

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
    await supabase.from('profiles').update(parseProfileUpdate(formData)).eq('id', user.id);
    revalidatePath('/dashboard');
    redirect('/dashboard');
  }

  const field = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground';
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profil</h1>
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
        <button className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90">
          Salvează
        </button>
      </form>
      <div className="mt-8 space-y-6">
        <GarminConnectForm />
        <UltrahumanConnectForm />
        <BankingConnectForm />
        <HomeAssistantConnectForm />
      </div>
    </div>
  );
}
