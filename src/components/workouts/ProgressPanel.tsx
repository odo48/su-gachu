'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { getExerciseSets, getLoggedExercises, getSetsForVolume } from '@/lib/workouts/queries';
import { exerciseHistory, volumePerMuscleGroup } from '@/lib/workouts/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';

const WEEKS_BACK = 8;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function ExerciseProgressCard({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [points, setPoints] = useState<ReturnType<typeof exerciseHistory>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLoggedExercises(supabase, userId).then((opts) => {
      setOptions(opts);
      if (opts.length && !selected) setSelected(opts[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getExerciseSets(supabase, userId, selected).then((sets) => {
      setPoints(exerciseHistory(sets));
      setLoading(false);
    });
  }, [supabase, userId, selected]);

  const pr = points.length
    ? points.reduce((best, p) => (p.estimatedOneRm > best.estimatedOneRm ? p : best))
    : null;
  const chartData = points.map((p) => ({ ...p, label: shortDate(p.date) }));

  if (!options.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progres pe exercițiu</CardTitle>
          <CardDescription>Record personal (1RM estimat) și evoluția greutății</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loghează câteva seturi ca să vezi progresul aici.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Progres pe exercițiu</CardTitle>
            <CardDescription>1RM estimat (formula Epley) per sesiune</CardDescription>
          </div>
          <Select value={selected ?? undefined} onValueChange={setSelected}>
            <SelectTrigger className="h-11 w-48" aria-label="Alege exercițiu">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pr && (
          <Badge variant="success" className="text-sm font-semibold tabular-nums">
            Record: {pr.estimatedOneRm} kg (1RM est.) — {pr.topWeightKg} kg × {pr.topReps}
          </Badge>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Se încarcă...</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Fără seturi de lucru înregistrate pentru acest exercițiu.</p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ ...CHART_MARGIN, left: 8, bottom: 8 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} dy={8} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} kg`, '1RM estimat']}
                />
                <Line
                  type="monotone"
                  dataKey="estimatedOneRm"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'hsl(var(--chart-1))', strokeWidth: 0 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MuscleVolumeCard({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<{ weekStart: string; muscle: string; volumeKg: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - WEEKS_BACK * 7);
    getSetsForVolume(supabase, userId, since.toISOString()).then(({ sets, muscleByExercise }) => {
      const volume = volumePerMuscleGroup(sets, muscleByExercise);
      setRows(volume);
      const distinctMuscles = Array.from(new Set(volume.map((v) => v.muscle))).sort();
      setMuscles(distinctMuscles);
      setSelected((prev) => prev ?? distinctMuscles[0] ?? null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  const chartData = selected
    ? rows.filter((r) => r.muscle === selected).map((r) => ({ ...r, label: shortDate(r.weekStart) }))
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Volum per grupă musculară</CardTitle>
            <CardDescription>Kg × reps pe săptămână, ultimele {WEEKS_BACK} săptămâni</CardDescription>
          </div>
          {muscles.length > 0 && (
            <Select value={selected ?? undefined} onValueChange={setSelected}>
              <SelectTrigger className="h-11 w-44" aria-label="Alege grupa musculară">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {muscles.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Se încarcă...</p>
        ) : muscles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Fără date de volum încă — loghează câteva antrenamente.</p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ ...CHART_MARGIN, left: 8, bottom: 8 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} dy={8} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kg`, 'Volum']} />
                <Bar dataKey="volumeKg" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProgressPanel({ userId }: { userId: string }) {
  return (
    <div className="space-y-4">
      <ExerciseProgressCard userId={userId} />
      <MuscleVolumeCard userId={userId} />
    </div>
  );
}
