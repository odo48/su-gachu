'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { axisTick, tooltipStyle } from '@/lib/chart-theme';

type Point = { date: string; weight: number };

export default function WeightChart({ data, target }: { data: Point[]; target?: number | null }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Încă nu ai date de greutate. Adaugă o cântărire mai jos.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        {target ? (
          <ReferenceLine y={target} stroke="hsl(var(--chart-1))" strokeDasharray="4 4" label="țintă" />
        ) : null}
        <Line type="monotone" dataKey="weight" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
