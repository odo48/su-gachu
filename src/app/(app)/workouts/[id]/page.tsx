import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { draftFromPrevious, getLastPerformance } from '@/lib/workouts/queries';
import ActiveWorkout, { type ExerciseEntry } from '@/components/workouts/ActiveWorkout';
import WorkoutDetail from '@/components/workouts/WorkoutDetail';
import type { WorkoutExercise, WorkoutSet } from '@/lib/workouts/types';
import type { ExerciseSummary } from '@/components/workouts/ExercisePicker';

type WorkoutExerciseRow = WorkoutExercise & { exercises: ExerciseSummary; workout_sets: WorkoutSet[] };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workoutId = Number(id);
  if (!Number.isFinite(workoutId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: workout } = await supabase.from('workouts').select('*').eq('id', workoutId).maybeSingle();
  if (!workout) notFound();

  const { data: weRows } = await supabase
    .from('workout_exercises')
    .select(
      'id, workout_id, exercise_id, position, notes, exercises(id, name, category, equipment, primary_muscles, images), workout_sets(*)'
    )
    .eq('workout_id', workout.id)
    .order('position', { ascending: true })
    .order('set_number', { foreignTable: 'workout_sets', ascending: true });

  const rows = (weRows ?? []) as unknown as WorkoutExerciseRow[];

  if (workout.ended_at) {
    const entries = rows.map((r) => ({ exercise: r.exercises, sets: r.workout_sets ?? [] }));
    return <WorkoutDetail workout={workout} entries={entries} />;
  }

  const initialEntries: ExerciseEntry[] = await Promise.all(
    rows.map(async (r) => {
      const previous = await getLastPerformance(supabase, user.id, r.exercise_id);
      const sets = r.workout_sets ?? [];
      return {
        workoutExercise: { id: r.id, workout_id: r.workout_id, exercise_id: r.exercise_id, position: r.position, notes: r.notes },
        exercise: r.exercises,
        sets,
        previous,
        restSeconds: 90,
        draft: draftFromPrevious(previous, sets.length),
      };
    })
  );

  return <ActiveWorkout workout={workout} userId={user.id} initialEntries={initialEntries} />;
}
