import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'default' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
};

const accentMap = {
  default: 'bg-primary/10 text-primary',
  green: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  purple: 'bg-violet-500/15 text-violet-400',
  teal: 'bg-cyan-500/15 text-cyan-400',
};

export function StatCard({ label, value, unit, sub, icon, accent = 'default' }: Props) {
  const empty = value == null || value === '' || value === 0;

  return (
    <Card className="transition-shadow duration-200 hover:shadow-lg">
      <CardContent className="flex flex-col gap-3 p-4">
        {icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accentMap[accent])}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {empty ? (
              <span className="text-muted-foreground/40">—</span>
            ) : (
              <>
                {typeof value === 'number' ? value.toLocaleString('ro-RO') : value}
                {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
              </>
            )}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
