import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkout } from '@/lib/workouts/queries';
import RoutineList, { type RoutineSummary } from '@/components/workouts/RoutineList';

export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [activeWorkout, { data: routinesRaw }] = await Promise.all([
    getActiveWorkout(supabase, user.id),
    supabase
      .from('workout_routines')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const routineIds = (routinesRaw ?? []).map((r) => r.id);
  const { data: routineExerciseRows } = routineIds.length
    ? await supabase.from('routine_exercises').select('routine_id').in('routine_id', routineIds)
    : { data: [] as { routine_id: number }[] };
  const routineExerciseCount = new Map<number, number>();
  for (const row of routineExerciseRows ?? []) {
    routineExerciseCount.set(row.routine_id, (routineExerciseCount.get(row.routine_id) ?? 0) + 1);
  }
  const routines: RoutineSummary[] = (routinesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    exerciseCount: routineExerciseCount.get(r.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/workouts" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Antrenamente
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Rutine</h1>
      </div>
      <RoutineList userId={user.id} initialRoutines={routines} hasActiveWorkout={!!activeWorkout} />
    </div>
  );
}
