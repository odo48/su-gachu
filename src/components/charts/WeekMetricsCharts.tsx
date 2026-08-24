'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GarminWeekRow } from '@/components/GarminWeekTable';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';

function chartData(rows: GarminWeekRow[]) {
  return [...rows].reverse().map(r => ({
    label: r.label.replace(/\s+\d{4}/, ''),
    kcal: r.totalKcal ?? 0,
    somn: r.sleepHours ?? 0,
    hr: r.avgHr ?? 0,
    hasKcal: r.totalKcal != null,
    hasSomn: r.sleepHours != null,
    hasHr: r.avgHr != null,
  }));
}

type Props = { rows: GarminWeekRow[] };

export default function WeekMetricsCharts({ rows }: Props) {
  const data = chartData(rows);
  const hasData = data.some(d => d.hasKcal || d.hasSomn || d.hasHr);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Graficele apar după ce sincronizezi câteva zile Garmin.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calorii arse</CardTitle>
          <CardDescription>Total zilnic (BMR + activitate)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ ...CHART_MARGIN, left: 8 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kcal`, 'Calorii']} />
              <Bar dataKey="kcal" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Somn & puls</CardTitle>
          <CardDescription>Ore de somn și HR mediu</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ ...CHART_MARGIN, left: 8, right: 8 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={axisTick} tickLine={false} axisLine={false} width={36} />
              <YAxis yAxisId="right" orientation="right" tick={axisTick} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
              <Line yAxisId="left" type="monotone" dataKey="somn" name="Somn (h)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="hr" name="HR (bpm)" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
