'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ListPlus, Loader2, Pencil, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type RoutineSummary = { id: number; name: string; exerciseCount: number };

export default function RoutineList({
  userId,
  initialRoutines,
  hasActiveWorkout,
}: {
  userId: string;
  initialRoutines: RoutineSummary[];
  hasActiveWorkout: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [routines, setRoutines] = useState(initialRoutines);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<number | null>(null);

  async function createRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('workout_routines')
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single();
    setCreating(false);
    if (error || !data) return;
    router.push(`/workouts/routines/${data.id}`);
  }

  async function startFromRoutine(routine: RoutineSummary) {
    if (hasActiveWorkout) return;
    setStartingId(routine.id);
    const { data: routineExercises } = await supabase
      .from('routine_exercises')
      .select('exercise_id, position')
      .eq('routine_id', routine.id)
      .order('position', { ascending: true });

    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, routine_id: routine.id, name: routine.name })
      .select()
      .single();
    if (error || !workout) {
      setStartingId(null);
      return;
    }

    if (routineExercises?.length) {
      await supabase.from('workout_exercises').insert(
        routineExercises.map((re, i) => ({ workout_id: workout.id, exercise_id: re.exercise_id, position: i }))
      );
    }
    router.push(`/workouts/${workout.id}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={createRoutine} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="routine-name">Rutină nouă</Label>
              <Input
                id="routine-name"
                placeholder="ex: Push day"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
              Creează
            </Button>
          </form>
        </CardContent>
      </Card>

      {routines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nu ai încă nicio rutină salvată.</p>
      ) : (
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.name}</p>
                    <Badge variant="secondary" className="mt-1 tabular-nums">
                      {r.exerciseCount} {r.exerciseCount === 1 ? 'exercițiu' : 'exerciții'}
                    </Badge>
                  </div>
                  <Link
                    href={`/workouts/routines/${r.id}`}
                    aria-label="Editează rutina"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-9 shrink-0')}
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    disabled={hasActiveWorkout || startingId === r.id}
                    onClick={() => startFromRoutine(r)}
                    title={hasActiveWorkout ? 'Ai deja un antrenament în curs' : undefined}
                  >
                    {startingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Start
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
