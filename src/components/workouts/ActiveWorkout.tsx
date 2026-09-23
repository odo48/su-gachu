'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Flag, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { draftFromPrevious, getLastPerformance, type PreviousSet, type SetDraft } from '@/lib/workouts/queries';
import { exerciseImageUrl } from '@/lib/workouts/images';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/lib/workouts/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExercisePicker, { type ExerciseSummary } from './ExercisePicker';
import RestTimer from './RestTimer';

const DEFAULT_REST_SECONDS = 90;

export type ExerciseEntry = {
  workoutExercise: WorkoutExercise;
  exercise: ExerciseSummary;
  sets: WorkoutSet[];
  previous: PreviousSet[];
  restSeconds: number;
  draft: SetDraft;
};

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
}) {
  const n = Number(value) || 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, n - step)))}
          aria-label={`Scade ${label.toLowerCase()}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors duration-200 hover:bg-muted/70"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-16 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => onChange(String(n + step))}
          aria-label={`Crește ${label.toLowerCase()}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors duration-200 hover:bg-muted/70"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function ActiveWorkout({
  workout,
  userId,
  initialEntries,
}: {
  workout: Workout;
  userId: string;
  initialEntries: ExerciseEntry[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [entries, setEntries] = useState<ExerciseEntry[]>(initialEntries);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restTimer, setRestTimer] = useState<{ key: number; seconds: number } | null>(null);
  const [busyExercise, setBusyExercise] = useState<number | null>(null);

  async function addExercise(ex: ExerciseSummary) {
    const position = entries.length;
    const { data, error } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: workout.id, exercise_id: ex.id, position })
      .select()
      .single();
    if (error || !data) return;

    const previous = await getLastPerformance(supabase, userId, ex.id);
    setEntries((prev) => [
      ...prev,
      {
        workoutExercise: data,
        exercise: ex,
        sets: [],
        previous,
        restSeconds: DEFAULT_REST_SECONDS,
        draft: draftFromPrevious(previous, 0),
      },
    ]);
  }

  async function removeExercise(workoutExerciseId: number) {
    setEntries((prev) => prev.filter((e) => e.workoutExercise.id !== workoutExerciseId));
    await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);
  }

  function updateDraft(workoutExerciseId: number, patch: Partial<SetDraft>) {
    setEntries((prev) =>
      prev.map((e) => (e.workoutExercise.id === workoutExerciseId ? { ...e, draft: { ...e.draft, ...patch } } : e))
    );
  }

  async function logSet(entry: ExerciseEntry) {
    const reps = Number(entry.draft.reps) || 0;
    const weightKg = entry.draft.weightKg === '' ? null : Number(entry.draft.weightKg);
    if (reps <= 0) return;

    setBusyExercise(entry.workoutExercise.id);
    const { data, error } = await supabase
      .from('workout_sets')
      .insert({
        workout_exercise_id: entry.workoutExercise.id,
        set_number: entry.sets.length + 1,
        reps,
        weight_kg: weightKg,
        is_warmup: entry.draft.warmup,
      })
      .select()
      .single();
    setBusyExercise(null);
    if (error || !data) return;

    setEntries((prev) =>
      prev.map((e) => {
        if (e.workoutExercise.id !== entry.workoutExercise.id) return e;
        const sets = [...e.sets, data];
        return { ...e, sets, draft: draftFromPrevious(e.previous, sets.length) };
      })
    );

    if (!entry.draft.warmup) {
      setRestTimer({ key: Date.now(), seconds: entry.restSeconds });
    }
  }

  async function deleteSet(entry: ExerciseEntry, set: WorkoutSet) {
    setEntries((prev) =>
      prev.map((e) =>
        e.workoutExercise.id === entry.workoutExercise.id
          ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) }
          : e
      )
    );
    await supabase.from('workout_sets').delete().eq('id', set.id);
  }

  async function finishWorkout() {
    setFinishing(true);
    const { error } = await supabase
      .from('workouts')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', workout.id);
    setFinishing(false);
    if (!error) router.push(`/workouts/${workout.id}`);
  }

  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Antrenament în curs</p>
          <h1 className="text-2xl font-bold tracking-tight">{workout.name}</h1>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {totalSets} {totalSets === 1 ? 'set' : 'seturi'}
        </Badge>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.workoutExercise.id}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4 pb-2">
              {entry.exercise.images[0] ? (
                <img
                  src={exerciseImageUrl(entry.exercise.images[0])}
                  alt=""
                  className="size-11 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="size-11 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{entry.exercise.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.exercise.primary_muscles.join(', ') || entry.exercise.category}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExercise(entry.workoutExercise.id)}
                aria-label="Elimină exercițiul"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2">
              {entry.sets.length > 0 && (
                <ul className="space-y-1">
                  {entry.sets.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        <span className="tabular-nums">
                          Set {s.set_number} — {s.reps} reps{s.weight_kg != null ? ` × ${s.weight_kg} kg` : ''}
                        </span>
                        {s.is_warmup && (
                          <Badge variant="outline" className="text-[10px]">
                            încălzire
                          </Badge>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSet(entry, s)}
                        aria-label="Șterge setul"
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
                <NumberField
                  label="Reps"
                  value={entry.draft.reps}
                  step={1}
                  onChange={(v) => updateDraft(entry.workoutExercise.id, { reps: v })}
                />
                <NumberField
                  label="Kg"
                  value={entry.draft.weightKg}
                  step={2.5}
                  onChange={(v) => updateDraft(entry.workoutExercise.id, { weightKg: v })}
                />
                <button
                  type="button"
                  onClick={() => updateDraft(entry.workoutExercise.id, { warmup: !entry.draft.warmup })}
                  className={`h-11 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors duration-200 ${
                    entry.draft.warmup
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                      : 'border-input text-muted-foreground'
                  }`}
                >
                  Încălzire
                </button>
                <Button
                  type="button"
                  onClick={() => logSet(entry)}
                  disabled={busyExercise === entry.workoutExercise.id || !entry.draft.reps}
                  className="h-11 flex-1"
                >
                  {busyExercise === entry.workoutExercise.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    `Log set ${entry.sets.length + 1}`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
        Adaugă exercițiu
      </Button>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-[calc(100%-2rem)] max-w-md flex-col gap-2 md:bottom-4">
        {restTimer && (
          <RestTimer key={restTimer.key} seconds={restTimer.seconds} onDismiss={() => setRestTimer(null)} />
        )}
        <Button
          type="button"
          variant="default"
          className="w-full shadow-xl"
          disabled={finishing || entries.length === 0}
          onClick={finishWorkout}
        >
          {finishing ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
          Finalizează antrenamentul
        </Button>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
    </div>
  );
}
