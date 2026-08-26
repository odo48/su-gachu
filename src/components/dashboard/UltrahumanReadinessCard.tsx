import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UltrahumanWeekRow } from '@/lib/dashboard/weekRows';
import { avg, coachNote, median, type Status } from './readiness';
import ReadinessStrip from './ReadinessStrip';

function assess(
  row: UltrahumanWeekRow,
  week: { hrvMed: number | null; rhrAvg: number | null }
): Status {
  if (row.sleepScore == null && row.recoveryIndex == null && row.nightRhrAvg == null && row.hrvLastRead == null) {
    return 'empty';
  }

  let flags = 0;
  if (row.sleepScore != null && row.sleepScore < 60) flags += 1;
  if (row.recoveryIndex != null && row.recoveryIndex < 60) flags += 1;
  if (week.rhrAvg != null && row.nightRhrAvg != null && row.nightRhrAvg >= week.rhrAvg + 3) flags += 1;
  if (week.hrvMed != null && row.hrvLastRead != null && row.hrvLastRead < week.hrvMed * 0.9) flags += 1;

  if (flags >= 2) return 'strained';
  if (
    flags === 0 &&
    row.sleepScore != null &&
    row.sleepScore >= 80 &&
    (row.recoveryIndex == null || row.recoveryIndex >= 70)
  ) {
    return 'recovered';
  }
  return 'ok';
}

type Props = { rows: UltrahumanWeekRow[] };

export default function UltrahumanReadinessCard({ rows }: Props) {
  const chrono = [...rows].reverse();
  const sleepScores = chrono.map((r) => r.sleepScore).filter((n): n is number => n != null);
  const recoveryVals = chrono.map((r) => r.recoveryIndex).filter((n): n is number => n != null);
  const hrvVals = chrono.map((r) => r.hrvLastRead).filter((n): n is number => n != null && n > 0);
  const rhrVals = chrono.map((r) => r.nightRhrAvg).filter((n): n is number => n != null && n > 0);

  const week = { hrvMed: median(hrvVals), rhrAvg: avg(rhrVals) };
  const sleepAvg = avg(sleepScores);
  const recoveryAvg = avg(recoveryVals);
  const days = chrono.map((r) => ({ row: r, status: assess(r, week) }));
  const hasData = days.some((d) => d.status !== 'empty');

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Readiness inel</CardTitle>
          <CardDescription>Sleep score, recovery și HRV de pe Ultrahuman</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apare după câteva nopți sincronizate cu inelul.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Readiness inel</CardTitle>
        <CardDescription>
          Sleep score și recovery index de pe Ultrahuman. Același semnal ca mai sus, dar din inel.
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
              {sleepAvg != null ? Math.round(sleepAvg) : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Sleep score</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center sm:p-3">
            <p className="text-base font-bold tabular-nums sm:text-lg">
              {recoveryAvg != null ? Math.round(recoveryAvg) : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Recovery</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center sm:p-3">
            <p className="text-base font-bold tabular-nums sm:text-lg">
              {week.hrvMed != null ? `${Math.round(week.hrvMed)} ms` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">HRV inel</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{coachNote(days.map((d) => d.status))}</p>
      </CardContent>
    </Card>
  );
}
