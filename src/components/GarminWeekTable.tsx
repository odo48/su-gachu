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

type GarminMetric = {
  date: string;
  active_kcal?: number | null;
  avg_hr?: number | null;
  sleep_minutes?: number | null;
  raw?: Record<string, unknown> | null;
};

export type GarminWeekRow = {
  date: string;
  label: string;
  isToday: boolean;
  totalKcal: number | null;
  sleepHours: number | null;
  bodyBattery: string | null;
  avgHr: number | null;
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
  const byDate = new Map(metrics.map(m => [m.date, m]));
  const today = new Date();
  const rows: GarminWeekRow[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const m = byDate.get(iso);
    const raw = (m?.raw ?? {}) as Record<string, unknown>;

    rows.push({
      date: iso,
      label: d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: i === 0,
      totalKcal: m ? kcalFromMetric(m) : null,
      sleepHours: m?.sleep_minutes != null ? m.sleep_minutes / 60 : null,
      bodyBattery: m ? fmtBodyBattery(raw) : null,
      avgHr: m?.avg_hr ?? null,
    });
  }

  return rows;
}

type Props = { rows: GarminWeekRow[]; embedded?: boolean };

export default function GarminWeekTable({ rows, embedded = false }: Props) {
  const hasAny = rows.some(r =>
    r.totalKcal != null || r.sleepHours != null || r.bodyBattery != null || r.avgHr != null,
  );

  const table = (
    <>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground py-4">
          Nu există date Garmin în ultima săptămână. Sincronizează ceasul din tab-ul Garmin.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zi</TableHead>
              <TableHead>Calorii</TableHead>
              <TableHead>Somn</TableHead>
              <TableHead>Body battery</TableHead>
              <TableHead>HR mediu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.date} className={row.isToday ? 'bg-muted/40' : undefined}>
                <TableCell className="font-medium whitespace-nowrap">
                  {row.label}
                  {row.isToday && (
                    <Badge variant="secondary" className="ml-2 text-[10px] py-0">azi</Badge>
                  )}
                </TableCell>
                <TableCell>{row.totalKcal != null ? `${fmtNum(row.totalKcal)} kcal` : '—'}</TableCell>
                <TableCell>
                  {row.sleepHours != null
                    ? `${row.sleepHours.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
                    : '—'}
                </TableCell>
                <TableCell>{row.bodyBattery ?? '—'}</TableCell>
                <TableCell>{row.avgHr != null ? `${fmtNum(row.avgHr)} bpm` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  if (embedded) return table;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tabel săptămână</CardTitle>
        <CardDescription>Ultimele 7 zile din Garmin</CardDescription>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}
