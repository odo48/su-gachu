import type { Status } from '@/components/dashboard/readiness';
import { STATUS_LABEL } from '@/components/dashboard/readiness';
import { cn } from '@/lib/utils';

export type ReadinessDay = {
  key: string;
  shortLabel: string;
  isToday: boolean;
  status: Status;
};

export default function ReadinessStrip({ days }: { days: ReadinessDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((day) => (
        <li
          key={day.key}
          className={cn(
            'rounded-lg px-0.5 py-2 text-center sm:px-1',
            day.status === 'recovered' && 'bg-emerald-500/10',
            day.status === 'ok' && 'bg-muted/60',
            day.status === 'strained' && 'bg-red-500/10',
            day.status === 'empty' && 'bg-muted/30',
            day.isToday && 'ring-1 ring-border'
          )}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
            {day.shortLabel}
          </p>
          <span
            className={cn(
              'mx-auto mt-1.5 block h-2 w-2 rounded-full',
              day.status === 'recovered' && 'bg-emerald-400',
              day.status === 'ok' && 'bg-amber-400',
              day.status === 'strained' && 'bg-red-400',
              day.status === 'empty' && 'bg-muted-foreground/30'
            )}
          />
          <p
            className={cn(
              'mt-1.5 hidden text-[10px] font-medium sm:block sm:text-xs',
              day.status === 'recovered' && 'text-emerald-400',
              day.status === 'ok' && 'text-amber-400',
              day.status === 'strained' && 'text-red-400',
              day.status === 'empty' && 'text-muted-foreground/50'
            )}
          >
            {STATUS_LABEL[day.status]}
          </p>
        </li>
      ))}
    </ol>
  );
}
