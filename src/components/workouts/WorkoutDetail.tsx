import { Dumbbell } from 'lucide-react';
import { exerciseImageUrl } from '@/lib/workouts/images';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Workout, WorkoutSet } from '@/lib/workouts/types';
import type { ExerciseSummary } from './ExercisePicker';
import DeleteWorkoutButton from './DeleteWorkoutButton';

type Entry = { exercise: ExerciseSummary; sets: WorkoutSet[] };

function formatDuration(startedAt: string, endedAt: string) {
  const minutes = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function WorkoutDetail({ workout, entries }: { workout: Workout; entries: Entry[] }) {
  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0);
  const totalVolume = entries.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + (set.weight_kg ?? 0) * (set.reps ?? 0), 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {new Date(workout.started_at).toLocaleDateString('ro-RO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{workout.name}</h1>
        </div>
        <DeleteWorkoutButton workoutId={workout.id} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {totalSets} {totalSets === 1 ? 'set' : 'seturi'}
        </Badge>
        <Badge variant="secondary" className="tabular-nums">
          {Math.round(totalVolume)} kg volum
        </Badge>
        {workout.ended_at && <Badge variant="outline">{formatDuration(workout.started_at, workout.ended_at)}</Badge>}
      </div>

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4 pb-2">
              {entry.exercise.images[0] ? (
                <img
                  src={exerciseImageUrl(entry.exercise.images[0])}
                  alt=""
                  className="size-10 shrink-0 rounded-md object-cover"
                />
              ) : (
                <Dumbbell className="size-10 shrink-0 rounded-md bg-muted p-2 text-muted-foreground" />
              )}
              <p className="truncate text-sm font-semibold">{entry.exercise.name}</p>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ul className="space-y-1 text-sm">
                {entry.sets.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 tabular-nums"
                  >
                    <span>Set {s.set_number}</span>
                    <span className="flex items-center gap-2">
                      {s.reps} reps{s.weight_kg != null ? ` × ${s.weight_kg} kg` : ''}
                      {s.is_warmup && (
                        <Badge variant="outline" className="text-[10px] font-normal normal-case">
                          încălzire
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
