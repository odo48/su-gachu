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
import type { AppleWatchWeekRow } from '@/lib/dashboard/weekRows';

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type Props = { rows: AppleWatchWeekRow[] };

export default function AppleWatchWeekTable({ rows }: Props) {
  const hasAny = rows.some(
    (r) => r.sleepHours != null || r.restingHr != null || r.hrv != null || r.steps != null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Săptămână Apple Watch</CardTitle>
        <CardDescription>Somn, stadii, HR și HRV de pe ceas</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nu există date Apple Watch în ultima săptămână. Apasă „Sincronizează Apple Watch" în tab-ul Sănătate.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zi</TableHead>
                  <TableHead>Somn</TableHead>
                  <TableHead>Deep</TableHead>
                  <TableHead>REM</TableHead>
                  <TableHead>RHR</TableHead>
                  <TableHead>HRV</TableHead>
                  <TableHead>Pași</TableHead>
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
                    <TableCell>
                      {row.sleepHours != null
                        ? `${row.sleepHours.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
                        : '—'}
                    </TableCell>
                    <TableCell>{row.deepMinutes != null ? `${fmtNum(row.deepMinutes)} m` : '—'}</TableCell>
                    <TableCell>{row.remMinutes != null ? `${fmtNum(row.remMinutes)} m` : '—'}</TableCell>
                    <TableCell>{row.restingHr != null ? `${fmtNum(row.restingHr)} bpm` : '—'}</TableCell>
                    <TableCell>{row.hrv != null ? `${fmtNum(row.hrv)} ms` : '—'}</TableCell>
                    <TableCell>{fmtNum(row.steps)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
