import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isoDateLocal } from '@/lib/garmin/dates';

type GarminMetric = {
  date: string;
  active_kcal?: number | null;
  avg_hr?: number | null;
  resting_hr?: number | null;
  sleep_minutes?: number | null;
  raw?: Record<string, unknown> | null;
};

export type GarminWeekRow = {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  totalKcal: number | null;
  sleepHours: number | null;
  bodyBattery: string | null;
  bodyBatteryHigh: number | null;
  intensityMin: number | null;
  stressAvg: number | null;
  workouts: number | null;
  avgHr: number | null;
  restingHr: number | null;
};

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('ro-RO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtBodyBattery(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const low = raw.body_battery_low as number | undefined;
  const high = raw.body_battery_high as number | undefined;
  if (low == null && high == null) return null;
  if (low != null && high != null) return `${low}–${high}%`;
  if (high != null) return `${high}%`;
  return `${low}%`;
}

function kcalFromMetric(m: GarminMetric): number | null {
  const raw = m.raw ?? {};
  const total = raw.total_kcal as number | undefined;
  if (total != null) return total;
  const active = m.active_kcal;
  const bmr = raw.bmr_kcal as number | undefined;
  if (active != null && bmr != null) return active + bmr;
  return active ?? null;
}

/** Ultimele 7 zile (azi inclus), cele mai recente sus. */
export function buildGarminWeekRows(metrics: GarminMetric[]): GarminWeekRow[] {
  const byDate = new Map(metrics.map((m) => [m.date, m]));
  const rows: GarminWeekRow[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = isoDateLocal(d);
    const m = byDate.get(iso);
    const raw = (m?.raw ?? {}) as Record<string, unknown>;

    const moderate = typeof raw.intensity_moderate_min === 'number' ? raw.intensity_moderate_min : 0;
    const vigorous = typeof raw.intensity_vigorous_min === 'number' ? raw.intensity_vigorous_min : 0;
    const intensityMin =
      m && (raw.intensity_moderate_min != null || raw.intensity_vigorous_min != null)
        ? moderate + vigorous
        : null;
    const acts = Array.isArray(raw.activities) ? raw.activities.length : null;

    rows.push({
      date: iso,
      label: d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' }),
      shortLabel: d.toLocaleDateString('ro-RO', { weekday: 'short' }).replace(/\.$/, ''),
      isToday: i === 0,
      totalKcal: m ? kcalFromMetric(m) : null,
      sleepHours: m?.sleep_minutes != null ? m.sleep_minutes / 60 : null,
      bodyBattery: m ? fmtBodyBattery(raw) : null,
      bodyBatteryHigh: typeof raw.body_battery_high === 'number' ? raw.body_battery_high : null,
      intensityMin,
      stressAvg: typeof raw.stress_avg === 'number' ? raw.stress_avg : null,
      workouts: m ? acts : null,
      avgHr: m?.avg_hr ?? null,
      restingHr: m?.resting_hr ?? null,
    });
  }

  return rows;
}

type Props = { rows: GarminWeekRow[]; embedded?: boolean };

export default function GarminWeekTable({ rows, embedded = false }: Props) {
  const hasAny = rows.some(
    (r) => r.bodyBattery != null || r.intensityMin != null || r.stressAvg != null || r.workouts != null
  );

  const table = (
    <>
      {!hasAny ? (
        <p className="py-4 text-sm text-muted-foreground">
          Nu există date Garmin în ultima săptămână. Sincronizează ceasul din tab-ul Garmin.
        </p>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zi</TableHead>
              <TableHead>Body battery</TableHead>
              <TableHead>Intensitate</TableHead>
              <TableHead>Stress</TableHead>
              <TableHead>Antrenamente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.date} className={row.isToday ? 'bg-muted/40' : undefined}>
                <TableCell className="whitespace-nowrap font-medium">
                  {row.label}
                  {row.isToday && (
                    <Badge variant="secondary" className="ml-2 py-0 text-[10px]">
                      azi
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{row.bodyBattery ?? '—'}</TableCell>
                <TableCell>{row.intensityMin != null ? `${fmtNum(row.intensityMin)} min` : '—'}</TableCell>
                <TableCell>{row.stressAvg != null ? fmtNum(row.stressAvg) : '—'}</TableCell>
                <TableCell>{row.workouts != null ? fmtNum(row.workouts) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </>
  );

  if (embedded) return table;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Săptămână Garmin</CardTitle>
        <CardDescription>Energie, intensitate și sesiuni — fără calorii/somn (sunt mai sus)</CardDescription>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}
