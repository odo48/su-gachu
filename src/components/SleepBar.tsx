import { Badge } from '@/components/ui/badge';

type Props = {
  totalMin?: number | null;
  deepSec?: number | null;
  lightSec?: number | null;
  remSec?: number | null;
  awakeSec?: number | null;
  score?: number | null;
};

export default function SleepBar({ totalMin, deepSec, lightSec, remSec, awakeSec, score }: Props) {
  const totalSec = (deepSec ?? 0) + (lightSec ?? 0) + (remSec ?? 0) + (awakeSec ?? 0);
  const hours = totalMin ? (totalMin / 60).toFixed(1) : null;

  const pct = (s?: number | null) => (totalSec ? Math.round(((s ?? 0) / totalSec) * 100) : 0);

  const scoreLabel =
    score == null
      ? null
      : score >= 80
        ? { text: 'Excelent', variant: 'success' as const }
        : score >= 60
          ? { text: 'Bun', variant: 'secondary' as const }
          : score >= 40
            ? { text: 'Slab', variant: 'warning' as const }
            : { text: 'Prost', variant: 'destructive' as const };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Somn</span>
        <div className="flex items-center gap-2">
          {hours && (
            <span className="text-lg font-bold">
              {hours}
              <span className="ml-0.5 text-sm font-normal text-muted-foreground">h</span>
            </span>
          )}
          {scoreLabel && (
            <Badge variant={scoreLabel.variant}>
              {scoreLabel.text} · {score}
            </Badge>
          )}
        </div>
      </div>

      {totalSec > 0 && (
        <>
          <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
            <div
              style={{ width: `${pct(deepSec)}%` }}
              className="rounded-l-full bg-secondary"
              title={`Deep ${pct(deepSec)}%`}
            />
            <div
              style={{ width: `${pct(remSec)}%` }}
              className="bg-primary"
              title={`REM ${pct(remSec)}%`}
            />
            <div
              style={{ width: `${pct(lightSec)}%` }}
              className="bg-cyan-400"
              title={`Light ${pct(lightSec)}%`}
            />
            <div
              style={{ width: `${pct(awakeSec)}%` }}
              className="rounded-r-full bg-muted"
              title={`Awake ${pct(awakeSec)}%`}
            />
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
              Deep {Math.round((deepSec ?? 0) / 60)}m
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              REM {Math.round((remSec ?? 0) / 60)}m
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
              Light {Math.round((lightSec ?? 0) / 60)}m
            </span>
          </div>
        </>
      )}
    </div>
  );
}
