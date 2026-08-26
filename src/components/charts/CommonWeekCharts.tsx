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
import { type CommonWeekRow, weekPulse } from '@/lib/dashboard/weekRows';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';

function chartData(rows: CommonWeekRow[]) {
  return [...rows].reverse().map((r) => {
    const hr = weekPulse(r);
    return {
      label: r.shortLabel,
      kcal: r.activeKcal ?? 0,
      somn: r.sleepHours ?? null,
      hr,
      hasKcal: r.activeKcal != null,
      hasSomn: r.sleepHours != null,
      hasHr: hr != null,
    };
  });
}

type Props = { rows: CommonWeekRow[] };

// Merged daily_biometrics: kcal + sleep/HR from whichever wearable contributed.
export default function CommonWeekCharts({ rows }: Props) {
  const data = chartData(rows);
  const hasData = data.some((d) => d.hasKcal || d.hasSomn || d.hasHr);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Graficele apar după ce ai câteva zile de date (sincronizate sau introduse manual).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calorii active</CardTitle>
          <CardDescription>Total zilnic, indiferent de sursă</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ ...CHART_MARGIN, left: 8 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${v} kcal`, 'Calorii']}
              />
              <Bar dataKey="kcal" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Somn & puls</CardTitle>
          <CardDescription>Ore de somn și puls (mediu sau de repaus)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ ...CHART_MARGIN, left: 8, right: 8 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={axisTick} tickLine={false} axisLine={false} width={36} />
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
                  if (name.startsWith('Somn')) {
                    return [
                      `${Number(v).toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
                      name,
                    ];
                  }
                  if (name.startsWith('HR')) return [`${v} bpm`, name];
                  return [v, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="somn"
                name="Somn (h)"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="hr"
                name="HR (bpm)"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
