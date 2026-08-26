'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { axisTick, CHART_MARGIN, gridStroke, tooltipStyle, weightYDomain } from '@/lib/chart-theme';

type Point = { date: string; weight: number };

function formatLabel(isoOrShort: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrShort)) {
    const d = new Date(isoOrShort + 'T12:00:00');
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
  return isoOrShort;
}

function formatFullDate(isoOrShort: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrShort)) {
    return new Date(isoOrShort + 'T12:00:00').toLocaleDateString('ro-RO', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return isoOrShort;
}

export default function WeightChartCard({
  data,
  target,
}: {
  data: Point[];
  target?: number | null;
}) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evoluție greutate</CardTitle>
          <CardDescription>Istoric din dispozitivele conectate sau introducere manuală</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Încă nu ai date de greutate. Adaugă manual din tab-ul Sănătate sau conectează un device de pe Profil.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    label: formatLabel(p.date),
  }));

  const weights = data.map((d) => d.weight);
  const latest = data[data.length - 1];
  const first = data[0];
  const delta = data.length > 1 ? latest.weight - first.weight : null;
  const yDomain = weightYDomain(weights, target);
  const toTarget = target != null ? latest.weight - target : null;

  const recent = [...data].reverse().slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Evoluție greutate</CardTitle>
            <CardDescription>
              {data.length} {data.length === 1 ? 'măsurătoare' : 'măsurători'}
              {target != null && ` · Țintă ${target} kg`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-sm font-semibold tabular-nums">
              {latest.weight.toLocaleString('ro-RO', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              kg
            </Badge>
            {delta != null && (
              <Badge variant={delta <= 0 ? 'success' : 'warning'} className="tabular-nums">
                {delta > 0 ? '+' : ''}
                {delta.toLocaleString('ro-RO', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                kg
              </Badge>
            )}
            {toTarget != null && (
              <Badge variant="outline" className="tabular-nums">
                {toTarget > 0 ? '+' : ''}
                {toTarget.toLocaleString('ro-RO', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                kg față de țintă
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ ...CHART_MARGIN, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                tickCount={5}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as Point & { label: string };
                  return row?.date ? formatFullDate(row.date) : '';
                }}
                formatter={(v: number) => [
                  `${v.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`,
                  'Greutate',
                ]}
              />
              {target != null && (
                <ReferenceLine
                  y={target}
                  stroke="hsl(var(--chart-2))"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{
                    value: `Țintă ${target} kg`,
                    position: 'insideTopRight',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                fill="url(#weightFill)"
                dot={{ r: data.length === 1 ? 5 : 4, fill: 'hsl(var(--chart-1))', strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Istoric recent
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Greutate</TableHead>
                <TableHead className="text-right">vs. anterior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((row, i) => {
                const prev = recent[i + 1];
                const diff = prev ? row.weight - prev.weight : null;
                return (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{formatFullDate(row.date)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.weight.toLocaleString('ro-RO', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      kg
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {diff == null ? (
                        '—'
                      ) : (
                        <span className={diff <= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                          {diff > 0 ? '+' : ''}
                          {diff.toLocaleString('ro-RO', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{' '}
                          kg
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
