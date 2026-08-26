'use client';

import { Dumbbell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  activityDisplayType,
  garminRecoveryMessages,
  parseGarminActivities,
  type GarminActivity,
} from '@/lib/sport';

type Props = {
  raw: Record<string, unknown>;
};

function ActivityRow({ a }: { a: GarminActivity }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{a.name}</p>
          <p className="text-xs text-muted-foreground">{activityDisplayType(a)}</p>
        </div>
        <div className="shrink-0 text-right text-sm tabular-nums">
          <p className="font-semibold">{a.duration_min} min</p>
          {a.calories != null && <p className="text-xs text-muted-foreground">{a.calories} kcal</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {a.avg_hr != null && (
          <Badge variant="outline" className="text-[10px]">
            HR mediu {a.avg_hr}
          </Badge>
        )}
        {a.max_hr != null && (
          <Badge variant="outline" className="text-[10px]">
            HR max {a.max_hr}
          </Badge>
        )}
        {a.training_effect != null && (
          <Badge variant="secondary" className="text-[10px]">
            TE {a.training_effect}
          </Badge>
        )}
        {a.body_battery_delta != null && (
          <Badge variant="secondary" className="text-[10px]">
            BB Δ{a.body_battery_delta}
          </Badge>
        )}
      </div>
      {(a.aerobic_message || a.anaerobic_message) && (
        <p className="border-t border-border/40 pt-2 text-xs leading-relaxed text-muted-foreground">
          {a.aerobic_message}
          {a.anaerobic_message && a.anaerobic_message !== a.aerobic_message && (
            <> · {a.anaerobic_message}</>
          )}
        </p>
      )}
    </div>
  );
}

export default function SportTodayCard({ raw }: Props) {
  const activities = parseGarminActivities(raw);
  const garminNotes = garminRecoveryMessages(activities);

  if (!activities.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-4 w-4" />
            Sport azi
          </CardTitle>
          <CardDescription>
            Nu apare nicio activitate în Garmin pentru azi. Înregistrează antrenamentul pe ceas, apoi
            reîncarcă sync.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4" />
          Sport azi
        </CardTitle>
        <CardDescription>Tip și metrici din Garmin Connect</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {activities.map((a, i) => (
            <ActivityRow key={a.id ?? i} a={a} />
          ))}
        </div>

        {garminNotes.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recuperare (Garmin)
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {garminNotes.map((note, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-primary">·</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
