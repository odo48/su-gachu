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
import type { CommonWeekRow } from '@/lib/dashboard/weekRows';

const SOURCE_LABELS: Record<string, string> = { garmin: 'Garmin', ultrahuman: 'Ultrahuman', manual: 'manual' };

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type Props = { rows: CommonWeekRow[] };

// Weekly counterpart to the "Sănătate" overview tab — same daily_biometrics
// table, whichever provider(s) fed each field, credited per row.
export default function CommonWeekTable({ rows }: Props) {
  const hasAny = rows.some(
    (r) => r.steps != null || r.activeKcal != null || r.sleepHours != null || r.avgHr != null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tabel săptămână</CardTitle>
        <CardDescription>Ultimele 7 zile, combinate din toate sursele conectate</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nu există date în ultima săptămână. Conectează un device sau introdu manual din tab-ul Sănătate.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zi</TableHead>
                <TableHead>Pași</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Somn</TableHead>
                <TableHead>HR mediu</TableHead>
                <TableHead>Surse</TableHead>
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
                  <TableCell>{fmtNum(row.steps)}</TableCell>
                  <TableCell>{row.activeKcal != null ? `${fmtNum(row.activeKcal)} kcal` : '—'}</TableCell>
                  <TableCell>
                    {row.sleepHours != null
                      ? `${row.sleepHours.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
                      : '—'}
                  </TableCell>
                  <TableCell>{row.avgHr != null ? `${fmtNum(row.avgHr)} bpm` : '—'}</TableCell>
                  <TableCell>
                    {row.sources.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.sources.map((s) => (
                          <Badge key={s} variant="outline" className="py-0 text-[10px]">
                            {SOURCE_LABELS[s] ?? s}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
