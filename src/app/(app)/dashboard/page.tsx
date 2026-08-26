import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DashboardTabs, {
  type CommonTodayData,
  type GarminTodayData,
  type UltrahumanTodayData,
} from '@/components/dashboard/DashboardTabs';
import { buildGarminWeekRows } from '@/components/GarminWeekTable';
import { buildCommonWeekRows, buildUltrahumanWeekRows } from '@/lib/dashboard/weekRows';
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

  const [
    { data: rec },
    { data: history },
    { data: todayCommon },
    { data: garminToday },
    { data: garminWeek },
    { data: garminConn },
    { data: ultrahumanToday },
    { data: ultrahumanConn },
    { data: commonWeek },
    { data: ultrahumanWeek },
  ] = await Promise.all([
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
    supabase.from('daily_biometrics').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
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
    supabase
      .from('ultrahuman_daily_biometrics')
      .select('*, ultrahuman_sleep_sessions(*)')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase.from('ultrahuman_connections').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('daily_biometrics')
      .select('date, steps, active_kcal, resting_hr, avg_hr, sleep_minutes, hrv, sources')
      .eq('user_id', user.id)
      .gte('date', weekStartIso)
      .lte('date', today),
    supabase
      .from('ultrahuman_daily_biometrics')
      .select('date, sleep_score, recovery_index, restfulness, night_rhr_avg, hrv_last_read, steps')
      .eq('user_id', user.id)
      .gte('date', weekStartIso)
      .lte('date', today),
  ]);

  const weightChart = (history ?? []).map((h) => ({ date: h.date, weight: Number(h.weight_kg) }));
  const garminWeekNormalized = (garminWeek ?? []).map((row) => ({
    ...row,
    raw: flattenGarminRaw((row.raw ?? {}) as Record<string, unknown>),
  }));
  const garminWeekRows = buildGarminWeekRows(garminWeekNormalized);
  const commonWeekRows = buildCommonWeekRows(
    (commonWeek ?? []).map((r) => ({ ...r, sources: r.sources as Record<string, string> | null }))
  );
  const ultrahumanWeekRows = buildUltrahumanWeekRows(ultrahumanWeek ?? []);
  const hasGarminToday = !!garminToday;
  const needsWeekSync = (garminWeek ?? []).length < 7;
  const garminConnected = !!garminConn;
  const ultrahumanConnected = !!ultrahumanConn;

  const todayData: CommonTodayData = todayCommon
    ? {
        weight_kg: todayCommon.weight_kg,
        steps: todayCommon.steps,
        active_kcal: todayCommon.active_kcal,
        resting_hr: todayCommon.resting_hr,
        avg_hr: todayCommon.avg_hr,
        sleep_minutes: todayCommon.sleep_minutes,
        hrv: todayCommon.hrv,
        vo2max: todayCommon.vo2max,
        sources: (todayCommon.sources as Record<string, string> | null) ?? {},
      }
    : null;

  const ultrahumanSleep = ultrahumanToday?.ultrahuman_sleep_sessions?.[0] ?? null;
  const ultrahumanData: UltrahumanTodayData = ultrahumanToday
    ? {
        hrLastRead: ultrahumanToday.hr_last_read,
        hrMin: ultrahumanToday.hr_min,
        hrMax: ultrahumanToday.hr_max,
        spo2Min: ultrahumanToday.spo2_min,
        spo2Max: ultrahumanToday.spo2_max,
        hrvLastRead: ultrahumanToday.hrv_last_read,
        hrvMin: ultrahumanToday.hrv_min,
        hrvMax: ultrahumanToday.hrv_max,
        steps: ultrahumanToday.steps,
        nightRhrAvg: ultrahumanToday.night_rhr_avg,
        nightRhrMin: ultrahumanToday.night_rhr_min,
        nightRhrMax: ultrahumanToday.night_rhr_max,
        sleepScore: ultrahumanToday.sleep_score,
        restfulness: ultrahumanToday.restfulness,
        sleepConsistency: ultrahumanToday.sleep_consistency,
        recoveryIndex: ultrahumanToday.recovery_index,
        movementIndex: ultrahumanToday.movement_index,
        vo2max: ultrahumanToday.vo2max,
        sleep: ultrahumanSleep
          ? {
              totalSleepSeconds: ultrahumanSleep.total_sleep_seconds,
              efficiency: ultrahumanSleep.efficiency,
              deepSeconds: ultrahumanSleep.deep_sleep_time_seconds,
              lightSeconds: ultrahumanSleep.light_sleep_time_seconds,
              remSeconds: ultrahumanSleep.rem_sleep_time_seconds,
              awakeSeconds: ultrahumanSleep.awake_sleep_time_seconds,
              completedCycles: ultrahumanSleep.completed_sleep_cycles,
              movements: ultrahumanSleep.movements,
              morningAlertness: ultrahumanSleep.morning_alertness,
            }
          : null,
      }
    : null;

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
        </div>
      </div>

      <DashboardTabs
        garminConnected={garminConnected}
        hasGarminToday={hasGarminToday}
        needsWeekSync={needsWeekSync}
        todayData={todayData}
        garminToday={garminTodayData}
        ultrahumanConnected={ultrahumanConnected}
        ultrahumanToday={ultrahumanData}
        commonWeekRows={commonWeekRows}
        ultrahumanWeekRows={ultrahumanWeekRows}
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
