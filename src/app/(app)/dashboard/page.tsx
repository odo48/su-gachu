import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardTabs, { type GarminTodayData } from '@/components/dashboard/DashboardTabs';
import { buildGarminWeekRows } from '@/components/GarminWeekTable';
import { Badge } from '@/components/ui/badge';
import { flattenGarminRaw } from '@/lib/garmin/raw';
import { isoDateLocal } from '@/lib/garmin/dates';
import recipesData from '@/data/recipes.json';

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const missing = [
    !profile?.birth_date && 'dată naștere',
    !profile?.height_cm && 'înălțime',
    !profile?.weight_kg && 'greutate',
  ].filter(Boolean) as string[];
  const profileReady = missing.length === 0;

  const today = isoDateLocal();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartIso = isoDateLocal(weekStart);

  const [{ data: rec }, { data: history }, { data: garminToday }, { data: garminWeek }, { data: garminConn }] =
    await Promise.all([
      supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_biometrics')
        .select('date, weight_kg')
        .eq('user_id', user.id)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: true })
        .limit(60),
      supabase
        .from('garmin_daily_biometrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('garmin_daily_biometrics')
        .select('date, active_kcal, avg_hr, sleep_minutes, raw')
        .eq('user_id', user.id)
        .gte('date', weekStartIso)
        .lte('date', today)
        .order('date', { ascending: false }),
      supabase.from('garmin_connections').select('email').eq('user_id', user.id).maybeSingle(),
    ]);

  const weightChart = (history ?? []).map((h) => ({ date: h.date, weight: Number(h.weight_kg) }));
  const garminWeekNormalized = (garminWeek ?? []).map((row) => ({
    ...row,
    raw: flattenGarminRaw((row.raw ?? {}) as Record<string, unknown>),
  }));
  const garminWeekRows = buildGarminWeekRows(garminWeekNormalized);
  const hasGarminToday = !!garminToday;
  const needsWeekSync = (garminWeek ?? []).length < 7;
  const garminConnected = !!garminConn;

  const todayRaw = flattenGarminRaw((garminToday?.raw ?? {}) as Record<string, unknown>);
  const garminTodayData: GarminTodayData = garminToday
    ? {
        active_kcal: garminToday.active_kcal,
        steps: garminToday.steps,
        resting_hr: garminToday.resting_hr,
        avg_hr: garminToday.avg_hr,
        sleep_minutes: garminToday.sleep_minutes,
        hrv: garminToday.hrv,
        vo2max: garminToday.vo2max,
        raw: todayRaw,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {new Date().toLocaleDateString('ro-RO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Bună{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!profileReady && (
            <Link href="/profile">
              <Badge variant="warning">Lipsește: {missing.join(', ')}</Badge>
            </Link>
          )}
          <Link href="/chat" className="text-sm text-secondary underline">
            Chat
          </Link>
          <Link href="/profile" className="text-sm text-secondary underline">
            Profil
          </Link>
        </div>
      </div>

      <DashboardTabs
        garminConnected={garminConnected}
        hasGarminToday={hasGarminToday}
        needsWeekSync={needsWeekSync}
        garminToday={garminTodayData}
        garminWeekRows={garminWeekRows}
        weightChart={weightChart}
        targetWeight={profile?.target_weight_kg}
        profileReady={profileReady}
        rec={rec as never}
        recipes={(recipesData as { recipes: unknown[] }).recipes}
      />
    </div>
  );
}
