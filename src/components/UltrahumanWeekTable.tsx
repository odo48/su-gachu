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
import type { UltrahumanWeekRow } from '@/lib/dashboard/weekRows';

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type Props = { rows: UltrahumanWeekRow[] };

export default function UltrahumanWeekTable({ rows }: Props) {
  const hasAny = rows.some(
    (r) => r.sleepScore != null || r.recoveryIndex != null || r.nightRhrAvg != null || r.hrvLastRead != null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tabel săptămână</CardTitle>
        <CardDescription>Ultimele 7 zile din Ultrahuman</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAny ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nu există date Ultrahuman în ultima săptămână. Sincronizează inelul din tab-ul Ultrahuman.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zi</TableHead>
                <TableHead>Sleep score</TableHead>
                <TableHead>Recovery</TableHead>
                <TableHead>Restfulness</TableHead>
                <TableHead>RHR nocturn</TableHead>
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
                  <TableCell>{fmtNum(row.sleepScore)}</TableCell>
                  <TableCell>{fmtNum(row.recoveryIndex)}</TableCell>
                  <TableCell>{fmtNum(row.restfulness)}</TableCell>
                  <TableCell>{row.nightRhrAvg != null ? `${fmtNum(row.nightRhrAvg)} bpm` : '—'}</TableCell>
                  <TableCell>{row.hrvLastRead != null ? `${fmtNum(row.hrvLastRead)} ms` : '—'}</TableCell>
                  <TableCell>{fmtNum(row.steps)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
