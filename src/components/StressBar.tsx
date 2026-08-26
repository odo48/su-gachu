import { Badge } from '@/components/ui/badge';

// Garmin returnează duratele de stres în SECUNDE (chiar dacă raw le numește *_min).
type Props = {
  restSec?: number | null;
  lowSec?: number | null;
  mediumSec?: number | null;
  highSec?: number | null;
  avg?: number | null;
  max?: number | null;
};

export default function StressBar({ restSec, lowSec, mediumSec, highSec, avg, max }: Props) {
  const totalSec = (restSec ?? 0) + (lowSec ?? 0) + (mediumSec ?? 0) + (highSec ?? 0);
  if (!totalSec && avg == null) return <p className="text-sm text-muted-foreground">Fără date stres</p>;

  const pct = (s?: number | null) => (totalSec ? Math.round(((s ?? 0) / totalSec) * 100) : 0);
  const toH = (s?: number | null) => (s ? `${Math.round((s / 3600) * 10) / 10}h` : '0h');

  const label =
    avg == null ? '—' : avg < 26 ? 'Relaxat' : avg < 51 ? 'Scăzut' : avg < 76 ? 'Mediu' : 'Ridicat';

  const badgeVariant =
    avg == null
      ? ('secondary' as const)
      : avg < 26
        ? ('success' as const)
        : avg < 51
          ? ('secondary' as const)
          : avg < 76
            ? ('warning' as const)
            : ('destructive' as const);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Stres zilnic
        </span>
        <div className="flex items-center gap-2">
          {avg != null && (
            <Badge variant={badgeVariant}>
              {label} · {avg}
            </Badge>
          )}
          {max != null && <span className="text-xs text-muted-foreground">Max {max}</span>}
        </div>
      </div>

      {totalSec > 0 && (
        <>
          <div className="flex h-3 overflow-hidden rounded-full gap-px">
            {pct(restSec) > 0 && (
              <div style={{ width: `${pct(restSec)}%` }} className="bg-sky-200" title={`Repaus ${toH(restSec)}`} />
            )}
            {pct(lowSec) > 0 && (
              <div style={{ width: `${pct(lowSec)}%` }} className="bg-emerald-400" title={`Scăzut ${toH(lowSec)}`} />
            )}
            {pct(mediumSec) > 0 && (
              <div
                style={{ width: `${pct(mediumSec)}%` }}
                className="bg-amber-400"
                title={`Mediu ${toH(mediumSec)}`}
              />
            )}
            {pct(highSec) > 0 && (
              <div style={{ width: `${pct(highSec)}%` }} className="bg-red-400" title={`Ridicat ${toH(highSec)}`} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-200" />
              Repaus {toH(restSec)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Scăzut {toH(lowSec)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Mediu {toH(mediumSec)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              Ridicat {toH(highSec)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
