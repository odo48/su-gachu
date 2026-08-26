'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GarminWeekRow } from '@/components/GarminWeekTable';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle } from '@/lib/chart-theme';

function chartData(rows: GarminWeekRow[]) {
  return [...rows].reverse().map((r) => ({
    label: r.shortLabel,
    battery: r.bodyBatteryHigh,
    intensity: r.intensityMin,
    hasBattery: r.bodyBatteryHigh != null,
    hasIntensity: r.intensityMin != null,
  }));
}

type Props = { rows: GarminWeekRow[] };

export default function GarminLoadChart({ rows }: Props) {
  const data = chartData(rows);
  const hasData = data.some((d) => d.hasBattery || d.hasIntensity);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Body battery și minutele de intensitate apar după ce sincronizezi Garmin.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Load & energie</CardTitle>
        <CardDescription>Minute de intensitate vs. body battery (doar Garmin)</CardDescription>
      </CardHeader>
        <CardContent className="min-w-0">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ ...CHART_MARGIN, left: 8, right: 8 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="left"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={36}
              domain={[0, 100]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number | string, name: string) => {
                if (v == null || v === '') return ['—', name];
                if (name.startsWith('Body')) return [`${v}%`, name];
                return [`${v} min`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
            <Bar
              yAxisId="right"
              dataKey="intensity"
              name="Intensitate (min)"
              fill="hsl(var(--chart-1))"
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="battery"
              name="Body battery (%)"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
