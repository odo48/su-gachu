'use client';

import {
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
import type { UltrahumanWeekRow } from '@/lib/dashboard/weekRows';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';

function chartData(rows: UltrahumanWeekRow[]) {
  return [...rows].reverse().map((r) => ({
    label: r.shortLabel,
    sleepScore: r.sleepScore,
    recovery: r.recoveryIndex,
    rhr: r.nightRhrAvg,
    hasScore: r.sleepScore != null,
    hasRecovery: r.recoveryIndex != null,
    hasRhr: r.nightRhrAvg != null,
  }));
}

type Props = { rows: UltrahumanWeekRow[] };

export default function UltrahumanWeekChart({ rows }: Props) {
  const data = chartData(rows);
  const hasData = data.some((d) => d.hasScore || d.hasRecovery || d.hasRhr);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Graficele apar după ce sincronizezi câteva nopți cu Ultrahuman.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recovery & sleep score</CardTitle>
        <CardDescription>Evoluție săptămânală, inel Ultrahuman</CardDescription>
      </CardHeader>
        <CardContent className="min-w-0">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ ...CHART_MARGIN, left: 8, right: 8 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={36} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number | string, name: string) => {
                if (v == null || v === '') return ['—', name];
                if (name.startsWith('RHR')) return [`${v} bpm`, name];
                return [v, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="sleepScore"
              name="Sleep score"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="recovery"
              name="Recovery index"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="rhr"
              name="RHR nocturn (bpm)"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
