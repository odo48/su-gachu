'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Flame,
  Footprints,
  Heart,
  Landmark,
  Sparkles,
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
import WeekMetricsCharts from '@/components/charts/WeekMetricsCharts';
import WeightChartCard from '@/components/charts/WeightChartCard';
import SportTodayCard from '@/components/SportTodayCard';
import BankingConnectForm from '@/components/BankingConnectForm';
import FinanceDashboard from '@/components/finance/FinanceDashboard';

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
  garminToday: GarminTodayData;
  garminWeekRows: GarminWeekRow[];
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
  garminToday,
  garminWeekRows,
  weightChart,
  targetWeight,
  profileReady,
  rec,
  recipes,
}: Props) {
  const [tab, setTab] = useState('garmin');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('banking')) setTab('banca');
  }, []);

  const raw = garminToday?.raw ?? {};
  const bbHigh = raw.body_battery_high as number | undefined;
  const bbAccent = !bbHigh
    ? ('default' as const)
    : bbHigh >= 70
      ? ('green' as const)
      : bbHigh >= 40
        ? ('amber' as const)
        : ('red' as const);

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="garmin" className="gap-1.5">
          <Activity className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Garmin</span>
          <span className="sm:hidden">Date</span>
        </TabsTrigger>
        <TabsTrigger value="plan" className="gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Plan zilei</span>
          <span className="sm:hidden">Plan</span>
        </TabsTrigger>
        <TabsTrigger value="trends" className="gap-1.5">
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Trends</span>
          <span className="sm:hidden">Trend</span>
        </TabsTrigger>
        <TabsTrigger value="banca" className="gap-1.5">
          <Landmark className="h-4 w-4 shrink-0" />
          Bancă
        </TabsTrigger>
      </TabsList>

      <TabsContent value="garmin" className="space-y-4">
        <Card>
          <CardContent className="pb-4 pt-4">
            <DailyMetricsForm
              garminConnected={garminConnected}
              hasGarminToday={hasGarminToday}
              needsWeekSync={needsWeekSync}
            />
          </CardContent>
        </Card>

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

      <TabsContent value="trends" className="space-y-4">
        <WeekMetricsCharts rows={garminWeekRows} />
        <GarminWeekTable rows={garminWeekRows} />
        <WeightChartCard data={weightChart} target={targetWeight} />
      </TabsContent>

      <TabsContent value="banca" className="space-y-6">
        <FinanceDashboard />
        <BankingConnectForm />
      </TabsContent>
    </Tabs>
  );
}
