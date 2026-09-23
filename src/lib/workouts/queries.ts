import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggedSet } from './progress';

export type PreviousSet = { setNumber: number; reps: number | null; weightKg: number | null };

export type SetDraft = { reps: string; weightKg: string; warmup: boolean };

/** Prefill the next set's input from the matching set in the previous session (or its last set). */
export function draftFromPrevious(previous: PreviousSet[], loggedCount: number): SetDraft {
  const p = previous[loggedCount] ?? previous[previous.length - 1];
  return {
    reps: p?.reps != null ? String(p.reps) : '',
    weightKg: p?.weightKg != null ? String(p.weightKg) : '',
    warmup: false,
  };
}

/** Working sets (warmups excluded) from the user's most recent completed session for this exercise. */
export async function getLastPerformance(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string
): Promise<PreviousSet[]> {
  const { data: workoutExercises } = await supabase
    .from('workout_exercises')
    .select('id, workouts!inner(user_id, started_at, ended_at)')
    .eq('exercise_id', exerciseId)
    .eq('workouts.user_id', userId)
    .not('workouts.ended_at', 'is', null)
    .order('started_at', { foreignTable: 'workouts', ascending: false })
    .limit(1);

  if (!workoutExercises?.length) return [];

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('set_number, reps, weight_kg, is_warmup')
    .eq('workout_exercise_id', workoutExercises[0].id)
    .order('set_number', { ascending: true });

  return (sets ?? [])
    .filter((s) => !s.is_warmup)
    .map((s) => ({ setNumber: s.set_number, reps: s.reps, weightKg: s.weight_kg }));
}

/** The user's in-progress workout, if any (schema enforces at most one). */
export async function getActiveWorkout(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  return data;
}

/** Distinct exercises this user has actually logged at least once — for progress pickers. */
export async function getLoggedExercises(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from('workout_exercises')
    .select('exercise_id, exercises(name), workouts!inner(user_id)')
    .eq('workouts.user_id', userId);

  const seen = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    if (!seen.has(row.exercise_id)) seen.set(row.exercise_id, row.exercises?.name ?? row.exercise_id);
  }
  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every logged set for one exercise, across all of this user's sessions. */
export async function getExerciseSets(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string
): Promise<LoggedSet[]> {
  const { data } = await supabase
    .from('workout_exercises')
    .select('id, exercise_id, workouts!inner(user_id, started_at), workout_sets(reps, weight_kg, is_warmup)')
    .eq('exercise_id', exerciseId)
    .eq('workouts.user_id', userId);

  const rows: LoggedSet[] = [];
  for (const we of (data ?? []) as any[]) {
    for (const s of we.workout_sets ?? []) {
      rows.push({
        workoutId: we.id,
        exerciseId: we.exercise_id,
        startedAt: we.workouts.started_at,
        weightKg: s.weight_kg,
        reps: s.reps,
        isWarmup: s.is_warmup,
      });
    }
  }
  return rows;
}

/** Every logged set since `sinceIso`, plus a muscle-group lookup — input for volumePerMuscleGroup(). */
export async function getSetsForVolume(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<{ sets: LoggedSet[]; muscleByExercise: Map<string, string[]> }> {
  const { data } = await supabase
    .from('workout_exercises')
    .select(
      'id, exercise_id, exercises(primary_muscles), workouts!inner(user_id, started_at), workout_sets(reps, weight_kg, is_warmup)'
    )
    .eq('workouts.user_id', userId)
    .gte('workouts.started_at', sinceIso);

  const sets: LoggedSet[] = [];
  const muscleByExercise = new Map<string, string[]>();
  for (const we of (data ?? []) as any[]) {
    muscleByExercise.set(we.exercise_id, we.exercises?.primary_muscles ?? []);
    for (const s of we.workout_sets ?? []) {
      sets.push({
        workoutId: we.id,
        exerciseId: we.exercise_id,
        startedAt: we.workouts.started_at,
        weightKg: s.weight_kg,
        reps: s.reps,
        isWarmup: s.is_warmup,
      });
    }
  }
  return { sets, muscleByExercise };
}
