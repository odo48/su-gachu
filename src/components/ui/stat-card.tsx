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
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-violet-100 text-violet-700',
  teal: 'bg-cyan-100 text-cyan-800',
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
