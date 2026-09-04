'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CircleDashed,
  Flame,
  Footprints,
  Gauge,
  Heart,
  Landmark,
  Moon,
  Sparkles,
  Sun,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import DailyMetricsForm from '@/components/DailyMetricsForm';
import RecommendButton from '@/components/RecommendButton';
import SleepBar from '@/components/SleepBar';
import StressBar from '@/components/StressBar';
import MealList from '@/components/RecipeModal';
import GarminWeekTable, { type GarminWeekRow } from '@/components/GarminWeekTable';
import WeightChartCard from '@/components/charts/WeightChartCard';
import SportTodayCard from '@/components/SportTodayCard';
import BankingConnectForm from '@/components/BankingConnectForm';
import GmailConnectForm from '@/components/GmailConnectForm';
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import SignalsPanel from '@/components/finance/SignalsPanel';
import CommonWeekCharts from '@/components/charts/CommonWeekCharts';
import CommonWeekTable from '@/components/CommonWeekTable';
import GarminLoadChart from '@/components/charts/GarminLoadChart';
import ReadinessWeekCard from '@/components/dashboard/ReadinessWeekCard';
import UltrahumanReadinessCard from '@/components/dashboard/UltrahumanReadinessCard';
import UltrahumanWeekChart from '@/components/charts/UltrahumanWeekChart';
import UltrahumanWeekTable from '@/components/UltrahumanWeekTable';
import type { CommonWeekRow, UltrahumanWeekRow } from '@/lib/dashboard/weekRows';

export type GarminTodayData = {
  active_kcal?: number | null;
  steps?: number | null;
  resting_hr?: number | null;
  avg_hr?: number | null;
  sleep_minutes?: number | null;
  hrv?: number | null;
  vo2max?: number | null;
  raw: Record<string, unknown>;
} | null;

// Merged view from the common `daily_biometrics` table — whichever
// wearable(s) the user has connected, translated into one row per day.
// `sources` names which provider last set each field, so the overview can
// still credit the right device instead of presenting one blended number.
export type CommonTodayData = {
  weight_kg: number | null;
  steps: number | null;
  active_kcal: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  sleep_minutes: number | null;
  hrv: number | null;
  vo2max: number | null;
  sources: Record<string, string>;
} | null;

const SOURCE_LABELS: Record<string, string> = { garmin: 'Garmin', ultrahuman: 'Ultrahuman', manual: 'manual' };

// Full-detail Ultrahuman ring data — ultrahuman_daily_biometrics +
// ultrahuman_sleep_sessions, not carried by the common table.
export type UltrahumanTodayData = {
  hrLastRead: number | null;
  hrMin: number | null;
  hrMax: number | null;
  spo2Min: number | null;
  spo2Max: number | null;
  hrvLastRead: number | null;
  hrvMin: number | null;
  hrvMax: number | null;
  steps: number | null;
  nightRhrAvg: number | null;
  nightRhrMin: number | null;
  nightRhrMax: number | null;
  sleepScore: number | null;
  restfulness: number | null;
  sleepConsistency: number | null;
  recoveryIndex: number | null;
  movementIndex: number | null;
  vo2max: number | null;
  sleep: {
    totalSleepSeconds: number | null;
    efficiency: number | null;
    deepSeconds: number | null;
    lightSeconds: number | null;
    remSeconds: number | null;
    awakeSeconds: number | null;
    completedCycles: number | null;
    movements: number | null;
    morningAlertness: number | null;
  } | null;
} | null;

export type PlanRec = {
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  rationale: string;
  suggested_meals: unknown[];
  training?: { focus: string; cardio_minutes?: number; notes?: string } | null;
};

type Props = {
  garminConnected: boolean;
  hasGarminToday: boolean;
  needsWeekSync: boolean;
  todayData: CommonTodayData;
  garminToday: GarminTodayData;
  ultrahumanConnected: boolean;
  ultrahumanToday: UltrahumanTodayData;
  garminWeekRows: GarminWeekRow[];
  commonWeekRows: CommonWeekRow[];
  ultrahumanWeekRows: UltrahumanWeekRow[];
  weightChart: { date: string; weight: number }[];
  targetWeight?: number | null;
  profileReady: boolean;
  rec: PlanRec | null;
  recipes: unknown[];
};

export default function DashboardTabs({
  garminConnected,
  hasGarminToday,
  needsWeekSync,
  todayData,
  garminToday,
  ultrahumanConnected,
  ultrahumanToday,
  garminWeekRows,
  commonWeekRows,
  ultrahumanWeekRows,
  weightChart,
  targetWeight,
  profileReady,
  rec,
  recipes,
}: Props) {
  const [tab, setTab] = useState('today');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('banking') || params.has('gmail')) setTab('banca');
  }, []);

  const sourceLabel = (field: string) => {
    const source = todayData?.sources?.[field];
    return source ? SOURCE_LABELS[source] ?? source : undefined;
  };

  const raw = garminToday?.raw ?? {};
  const bbHigh = raw.body_battery_high as number | undefined;
  const bbAccent = !bbHigh
    ? ('default' as const)
    : bbHigh >= 70
      ? ('green' as const)
      : bbHigh >= 40
        ? ('amber' as const)
        : ('red' as const);

  const extraTabs = (garminConnected ? 1 : 0) + (ultrahumanConnected ? 1 : 0);
  const mdGridClass = extraTabs === 2 ? 'md:grid-cols-6' : extraTabs === 1 ? 'md:grid-cols-5' : 'md:grid-cols-4';

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
      <TabsList className={`no-scrollbar flex h-12 w-full justify-start gap-0 overflow-x-auto md:grid ${mdGridClass}`}>
        <TabsTrigger value="today" aria-label="Sănătate" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
          <Sun className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Sănătate</span>
        </TabsTrigger>
        {garminConnected && (
          <TabsTrigger value="garmin" aria-label="Garmin" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
            <Activity className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Garmin</span>
          </TabsTrigger>
        )}
        {ultrahumanConnected && (
          <TabsTrigger value="ultrahuman" aria-label="Ultrahuman" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
            <CircleDashed className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Ultrahuman</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="plan" aria-label="Plan zilei" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Plan zilei</span>
        </TabsTrigger>
        <TabsTrigger value="trends" aria-label="Trends" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Trends</span>
        </TabsTrigger>
        <TabsTrigger value="banca" aria-label="Bancă" className="min-w-11 flex-none px-2.5 md:min-w-0 md:flex-1">
          <Landmark className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Bancă</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="space-y-4">
        <Card>
          <CardContent className="pb-4 pt-4">
            <DailyMetricsForm
              garminConnected={garminConnected}
              hasGarminToday={hasGarminToday}
              needsWeekSync={needsWeekSync}
              ultrahumanConnected={ultrahumanConnected}
            />
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prezentare generală
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Greutate"
              value={todayData?.weight_kg}
              unit="kg"
              sub={sourceLabel('weight_kg')}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Pași"
              value={todayData?.steps}
              accent="teal"
              sub={sourceLabel('steps')}
              icon={<Footprints className="h-4 w-4" />}
            />
            <StatCard
              label="Active"
              value={todayData?.active_kcal}
              unit="kcal"
              accent="green"
              sub={sourceLabel('active_kcal')}
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              label="Somn"
              value={todayData?.sleep_minutes != null ? Math.round((todayData.sleep_minutes / 60) * 10) / 10 : undefined}
              unit="h"
              accent="purple"
              sub={sourceLabel('sleep_minutes')}
            />
            <StatCard
              label="HR repaus"
              value={todayData?.resting_hr}
              unit="bpm"
              accent="red"
              sub={sourceLabel('resting_hr')}
              icon={<Heart className="h-4 w-4" />}
            />
            <StatCard label="HR mediu" value={todayData?.avg_hr} unit="bpm" accent="amber" sub={sourceLabel('avg_hr')} />
            <StatCard label="HRV" value={todayData?.hrv} unit="ms" accent="purple" sub={sourceLabel('hrv')} />
            <StatCard label="VO₂ max" value={todayData?.vo2max} accent="teal" sub={sourceLabel('vo2max')} />
          </div>
        </div>
      </TabsContent>

      {garminConnected && (
      <TabsContent value="garmin" className="space-y-4">
        <SportTodayCard raw={raw} />

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Calorii & energie
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Active"
              value={garminToday?.active_kcal}
              unit="kcal"
              sub="sport / mișcare"
              accent="green"
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              label="BMR"
              value={raw.bmr_kcal as number}
              unit="kcal"
              accent="default"
              icon={<Heart className="h-4 w-4" />}
            />
            <StatCard
              label="Total ars"
              value={raw.total_kcal as number}
              unit="kcal"
              sub="BMR + active"
              accent="purple"
              icon={<Flame className="h-4 w-4" />}
            />
            <StatCard
              label="Body battery"
              value={bbHigh}
              unit="%"
              accent={bbAccent}
              sub={raw.body_battery_low != null ? `Min ${raw.body_battery_low}%` : undefined}
              icon={<Activity className="h-4 w-4" />}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Activitate
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Pași"
              value={garminToday?.steps}
              accent="teal"
              sub={raw.distance_m ? `${((raw.distance_m as number) / 1000).toFixed(1)} km` : undefined}
              icon={<Footprints className="h-4 w-4" />}
            />
            <StatCard
              label="Mod. intensitate"
              value={raw.intensity_moderate_min as number}
              unit="min"
              accent="green"
            />
            <StatCard
              label="Vig. intensitate"
              value={raw.intensity_vigorous_min as number}
              unit="min"
              accent="red"
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard label="Etaje" value={raw.floors as number} accent="default" />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cardiovascular
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="HR repaus"
              value={garminToday?.resting_hr}
              unit="bpm"
              accent="red"
              icon={<Heart className="h-4 w-4" />}
            />
            <StatCard
              label="HR mediu"
              value={garminToday?.avg_hr}
              unit="bpm"
              accent="amber"
              sub={raw.max_hr ? `Max ${raw.max_hr} bpm` : undefined}
            />
            <StatCard
              label="HRV"
              value={garminToday?.hrv}
              unit="ms"
              accent="purple"
              sub={raw.hrv_status as string}
            />
            <StatCard label="VO₂ max" value={garminToday?.vo2max} accent="teal" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-5">
              <SleepBar
                totalMin={garminToday?.sleep_minutes}
                deepSec={raw.deep_sleep_seconds as number}
                lightSec={raw.light_sleep_seconds as number}
                remSec={raw.rem_sleep_seconds as number}
                awakeSec={raw.awake_sleep_seconds as number}
                score={raw.sleep_score as number}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <StressBar
                restSec={raw.stress_rest_min as number}
                lowSec={raw.stress_low_min as number}
                mediumSec={raw.stress_medium_min as number}
                highSec={raw.stress_high_min as number}
                avg={raw.stress_avg as number}
                max={raw.stress_max as number}
              />
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      )}

      {ultrahumanConnected && (
      <TabsContent value="ultrahuman" className="space-y-4">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recovery & somn
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Sleep score"
              value={ultrahumanToday?.sleepScore}
              accent="purple"
              icon={<Moon className="h-4 w-4" />}
            />
            <StatCard label="Restfulness" value={ultrahumanToday?.restfulness} accent="teal" />
            <StatCard label="Consistență somn" value={ultrahumanToday?.sleepConsistency} accent="default" />
            <StatCard
              label="Recovery index"
              value={ultrahumanToday?.recoveryIndex}
              accent="green"
              icon={<Gauge className="h-4 w-4" />}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cardiovascular & activitate
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="RHR nocturn"
              value={ultrahumanToday?.nightRhrAvg}
              unit="bpm"
              accent="red"
              sub={
                ultrahumanToday?.nightRhrMin != null
                  ? `${ultrahumanToday.nightRhrMin}–${ultrahumanToday.nightRhrMax} bpm`
                  : undefined
              }
              icon={<Heart className="h-4 w-4" />}
            />
            <StatCard
              label="HRV"
              value={ultrahumanToday?.hrvLastRead}
              unit="ms"
              accent="purple"
              sub={
                ultrahumanToday?.hrvMin != null
                  ? `${ultrahumanToday.hrvMin}–${ultrahumanToday.hrvMax} ms`
                  : undefined
              }
            />
            <StatCard
              label="SPO2"
              value={ultrahumanToday?.spo2Max}
              unit="%"
              accent="teal"
              sub={
                ultrahumanToday?.spo2Min != null
                  ? `Min ${ultrahumanToday.spo2Min}%`
                  : undefined
              }
            />
            <StatCard
              label="Pași"
              value={ultrahumanToday?.steps}
              accent="green"
              icon={<Footprints className="h-4 w-4" />}
            />
            <StatCard label="VO₂ max" value={ultrahumanToday?.vo2max} accent="teal" />
            <StatCard label="Movement index" value={ultrahumanToday?.movementIndex} accent="default" />
          </div>
        </div>

        {ultrahumanToday?.sleep && (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <SleepBar
                totalMin={
                  ultrahumanToday.sleep.totalSleepSeconds != null
                    ? Math.round(ultrahumanToday.sleep.totalSleepSeconds / 60)
                    : null
                }
                deepSec={ultrahumanToday.sleep.deepSeconds}
                lightSec={ultrahumanToday.sleep.lightSeconds}
                remSec={ultrahumanToday.sleep.remSeconds}
                awakeSec={ultrahumanToday.sleep.awakeSeconds}
                score={ultrahumanToday.sleepScore}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ultrahumanToday.sleep.efficiency != null && <span>Eficiență {ultrahumanToday.sleep.efficiency}%</span>}
                {ultrahumanToday.sleep.completedCycles != null && (
                  <span>{ultrahumanToday.sleep.completedCycles} cicluri complete</span>
                )}
                {ultrahumanToday.sleep.movements != null && <span>{ultrahumanToday.sleep.movements} mișcări</span>}
                {ultrahumanToday.sleep.morningAlertness != null && (
                  <span>Alertness dimineață {ultrahumanToday.sleep.morningAlertness}min</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      )}

      <TabsContent value="plan" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Planul zilei</h3>
            <p className="text-sm text-muted-foreground">Mese, macro-uri și antrenament</p>
          </div>
          {profileReady && <RecommendButton />}
        </div>

        {rec ? (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'kcal', value: rec.target_calories },
                  { label: 'Proteină', value: `${rec.target_protein_g}g` },
                  { label: 'Carbo', value: `${rec.target_carbs_g}g` },
                  { label: 'Grăsimi', value: `${rec.target_fat_g}g` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/60 p-3 text-center">
                    <div className="text-lg font-bold tabular-nums">{value}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{rec.rationale}</p>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mese sugerate · apasă pentru detalii
                </p>
                <MealList meals={rec.suggested_meals as { recipe_id: string; name: string; slot: string }[]} recipes={recipes as never[]} />
              </div>

              {rec.training && (
                <div className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-80">
                    Antrenament
                  </p>
                  <p className="font-semibold">{rec.training.focus}</p>
                  <p className="mt-0.5 text-sm opacity-80">
                    {(rec.training.cardio_minutes ?? 0) > 0 &&
                      `${rec.training.cardio_minutes} min cardio · `}
                    {rec.training.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Niciun plan generat azi.</p>
              {profileReady && <RecommendButton />}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="trends" className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prezentare săptămână
          </h3>
          <CommonWeekCharts rows={commonWeekRows} />
          <ReadinessWeekCard rows={commonWeekRows} />
          <CommonWeekTable rows={commonWeekRows} />
        </div>

        <WeightChartCard data={weightChart} target={targetWeight} />

        {garminConnected && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Garmin — load & energie
            </h3>
            <div className="space-y-4">
              <GarminLoadChart rows={garminWeekRows} />
              <GarminWeekTable rows={garminWeekRows} />
            </div>
          </div>
        )}

        {ultrahumanConnected && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ultrahuman — recovery
            </h3>
            <div className="space-y-4">
              <UltrahumanReadinessCard rows={ultrahumanWeekRows} />
              <UltrahumanWeekChart rows={ultrahumanWeekRows} />
              <UltrahumanWeekTable rows={ultrahumanWeekRows} />
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="banca" className="space-y-6">
        <FinanceDashboard />
        <SignalsPanel />
        <GmailConnectForm />
        <BankingConnectForm />
      </TabsContent>
    </Tabs>
  );
}
