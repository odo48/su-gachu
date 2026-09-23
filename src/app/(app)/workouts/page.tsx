import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkout } from '@/lib/workouts/queries';
import WorkoutsTabs, { type HistoryRow } from '@/components/workouts/WorkoutsTabs';
import type { RoutineSummary } from '@/components/workouts/RoutineList';

export default async function WorkoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [activeWorkout, { data: routinesRaw }, { data: workoutsRaw }] = await Promise.all([
    getActiveWorkout(supabase, user.id),
    supabase
      .from('workout_routines')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('workouts')
      .select('id, name, started_at')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),
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

  const workoutIds = (workoutsRaw ?? []).map((w) => w.id);
  const { data: weRows } = workoutIds.length
    ? await supabase.from('workout_exercises').select('id, workout_id').in('workout_id', workoutIds)
    : { data: [] as { id: number; workout_id: number }[] };
  const weIds = (weRows ?? []).map((r) => r.id);
  const { data: setRows } = weIds.length
    ? await supabase.from('workout_sets').select('workout_exercise_id').in('workout_exercise_id', weIds)
    : { data: [] as { workout_exercise_id: number }[] };

  const exerciseCountByWorkout = new Map<number, number>();
  const workoutIdByWorkoutExercise = new Map<number, number>();
  for (const r of weRows ?? []) {
    exerciseCountByWorkout.set(r.workout_id, (exerciseCountByWorkout.get(r.workout_id) ?? 0) + 1);
    workoutIdByWorkoutExercise.set(r.id, r.workout_id);
  }
  const setCountByWorkout = new Map<number, number>();
  for (const r of setRows ?? []) {
    const workoutId = workoutIdByWorkoutExercise.get(r.workout_exercise_id);
    if (workoutId != null) setCountByWorkout.set(workoutId, (setCountByWorkout.get(workoutId) ?? 0) + 1);
  }

  const history: HistoryRow[] = (workoutsRaw ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    startedAt: w.started_at,
    exerciseCount: exerciseCountByWorkout.get(w.id) ?? 0,
    setCount: setCountByWorkout.get(w.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sală</p>
        <h1 className="text-2xl font-bold tracking-tight">Antrenamente</h1>
      </div>

      <WorkoutsTabs
        userId={user.id}
        activeWorkout={activeWorkout ? { id: activeWorkout.id, name: activeWorkout.name } : null}
        history={history}
        routines={routines}
      />
    </div>
  );
}
