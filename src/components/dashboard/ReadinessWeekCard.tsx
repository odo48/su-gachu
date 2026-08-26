import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommonWeekRow } from '@/lib/dashboard/weekRows';
import { avg, coachNote, median, type Status } from './readiness';
import ReadinessStrip from './ReadinessStrip';

function assess(row: CommonWeekRow, week: { hrvMed: number | null; rhrAvg: number | null }): Status {
  if (row.sleepHours == null && row.hrv == null && row.restingHr == null) return 'empty';

  let flags = 0;
  if (row.sleepHours != null && row.sleepHours < 6) flags += 1;
  if (week.rhrAvg != null && row.restingHr != null && row.restingHr >= week.rhrAvg + 3) flags += 1;
  if (week.hrvMed != null && row.hrv != null && row.hrv < week.hrvMed * 0.9) flags += 1;

  if (flags >= 2) return 'strained';
  if (flags === 0 && row.sleepHours != null && row.sleepHours >= 7) return 'recovered';
  return 'ok';
}

type Props = { rows: CommonWeekRow[] };

export default function ReadinessWeekCard({ rows }: Props) {
  const chrono = [...rows].reverse();
  const sleepVals = chrono.map((r) => r.sleepHours).filter((n): n is number => n != null);
  const hrvVals = chrono.map((r) => r.hrv).filter((n): n is number => n != null && n > 0);
  const rhrVals = chrono.map((r) => r.restingHr).filter((n): n is number => n != null && n > 0);

  const week = { hrvMed: median(hrvVals), rhrAvg: avg(rhrVals) };
  const sleepAvg = avg(sleepVals);
  const days = chrono.map((r) => ({ row: r, status: assess(r, week) }));
  const hasData = days.some((d) => d.status !== 'empty');

  const latestRhr = [...rhrVals].pop();
  const rhrDelta = week.rhrAvg != null && latestRhr != null ? latestRhr - week.rhrAvg : null;

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Readiness</CardTitle>
          <CardDescription>Somn, HRV și puls de repaus — semnalul de overload</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apare după câteva nopți cu somn sau HRV (Garmin / Ultrahuman).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Readiness</CardTitle>
        <CardDescription>
          Somn, HRV și puls de repaus. Nu e sfat medical — e semnal să ajustezi volumul la sală.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReadinessStrip
          days={days.map(({ row, status }) => ({
            key: row.date,
            shortLabel: row.shortLabel,
            isToday: row.isToday,
            status,
          }))}
        />

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/60 p-2 text-center sm:p-3">
            <p className="text-base font-bold tabular-nums sm:text-lg">
              {sleepAvg != null
                ? `${sleepAvg.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
                : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Somn mediu</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center sm:p-3">
            <p className="text-base font-bold tabular-nums sm:text-lg">
              {week.hrvMed != null ? `${Math.round(week.hrvMed)} ms` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">HRV mediu</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center sm:p-3">
            <p className="text-base font-bold tabular-nums sm:text-lg">
              {rhrDelta == null
                ? '—'
                : `${rhrDelta > 0 ? '+' : ''}${rhrDelta.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} bpm`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">RHR vs. medie</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{coachNote(days.map((d) => d.status))}</p>
      </CardContent>
    </Card>
  );
}
