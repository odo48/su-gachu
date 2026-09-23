import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import RoutineBuilder from '@/components/workouts/RoutineBuilder';
import type { RoutineExercise } from '@/lib/workouts/types';
import type { ExerciseSummary } from '@/components/workouts/ExercisePicker';

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isFinite(routineId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: routine } = await supabase.from('workout_routines').select('*').eq('id', routineId).maybeSingle();
  if (!routine) notFound();

  const { data: entriesRaw } = await supabase
    .from('routine_exercises')
    .select('*, exercises(id, name, category, equipment, primary_muscles, images)')
    .eq('routine_id', routineId)
    .order('position', { ascending: true });

  const entries = (entriesRaw ?? []) as unknown as (RoutineExercise & { exercises: ExerciseSummary })[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/workouts/routines"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Rutine
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{routine.name}</h1>
      </div>
      <RoutineBuilder
        routineId={routine.id}
        initialName={routine.name}
        initialEntries={entries.map((e) => ({ ...e, exercise: e.exercises }))}
      />
    </div>
  );
}
