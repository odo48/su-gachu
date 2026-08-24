import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardTabs, { type GarminTodayData } from '@/components/dashboard/DashboardTabs';
import { buildGarminWeekRows } from '@/components/GarminWeekTable';
import { Badge } from '@/components/ui/badge';
import recipesData from '@/data/recipes.json';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const missing = [
    !profile?.birth_date && 'dată naștere',
    !profile?.height_cm  && 'înălțime',
    !profile?.weight_kg  && 'greutate',
  ].filter(Boolean) as string[];
  const profileReady = missing.length === 0;

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [{ data: rec }, { data: history }, { data: garminToday }, { data: garminWeek }] = await Promise.all([
    supabase.from('recommendations').select('*')
      .eq('user_id', user.id).eq('date', today)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_metrics').select('date, weight_kg')
      .eq('user_id', user.id).not('weight_kg', 'is', null)
      .order('date', { ascending: true }).limit(60),
    supabase.from('daily_metrics').select('*')
      .eq('user_id', user.id).eq('date', today).eq('source', 'garmin')
      .maybeSingle(),
    supabase.from('daily_metrics').select('date, active_kcal, avg_hr, sleep_minutes, raw')
      .eq('user_id', user.id).eq('source', 'garmin')
      .gte('date', weekStartIso).lte('date', today)
      .order('date', { ascending: false }),
  ]);

  const weightChart = (history ?? []).map(h => ({ date: h.date, weight: Number(h.weight_kg) }));
  const garminWeekRows = buildGarminWeekRows(garminWeek ?? []);
  const hasGarminToday = !!garminToday;
  const needsWeekSync = (garminWeek ?? []).length < 7;

  const garminTodayData: GarminTodayData = garminToday
    ? {
        active_kcal: garminToday.active_kcal,
        steps: garminToday.steps,
        resting_hr: garminToday.resting_hr,
        avg_hr: garminToday.avg_hr,
        sleep_minutes: garminToday.sleep_minutes,
        hrv: garminToday.hrv,
        vo2max: garminToday.vo2max,
        raw: (garminToday.raw ?? {}) as Record<string, unknown>,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Bună{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
        </div>
        {!profileReady && (
          <Link href="/profile">
            <Badge variant="warning">⚠ Lipsește: {missing.join(', ')}</Badge>
          </Link>
        )}
      </div>

      <DashboardTabs
        hasGarminToday={hasGarminToday}
        needsWeekSync={needsWeekSync}
        garminToday={garminTodayData}
        garminWeekRows={garminWeekRows}
        weightChart={weightChart}
        targetWeight={profile?.target_weight_kg}
        profileReady={profileReady}
        rec={rec as any}
        recipes={(recipesData as any).recipes}
      />
    </div>
  );
}
