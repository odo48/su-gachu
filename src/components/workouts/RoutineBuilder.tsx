'use client';

import { useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { exerciseImageUrl } from '@/lib/workouts/images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import ExercisePicker, { type ExerciseSummary } from './ExercisePicker';
import type { RoutineExercise } from '@/lib/workouts/types';

type Entry = RoutineExercise & { exercise: ExerciseSummary };

export default function RoutineBuilder({
  routineId,
  initialName,
  initialEntries,
}: {
  routineId: number;
  initialName: string;
  initialEntries: Entry[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(initialName);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);

  async function saveName() {
    if (name.trim() === initialName || !name.trim()) return;
    setSavingName(true);
    await supabase
      .from('workout_routines')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', routineId);
    setSavingName(false);
  }

  async function addExercise(ex: ExerciseSummary) {
    const position = entries.length;
    const { data, error } = await supabase
      .from('routine_exercises')
      .insert({ routine_id: routineId, exercise_id: ex.id, position, target_sets: 3, rest_seconds: 90 })
      .select()
      .single();
    if (error || !data) return;
    setEntries((prev) => [...prev, { ...data, exercise: ex }]);
  }

  async function removeExercise(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('routine_exercises').delete().eq('id', id);
  }

  async function updateEntry(id: number, patch: Partial<RoutineExercise>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await supabase.from('routine_exercises').update(patch).eq('id', id);
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="routine-name">Nume rutină</Label>
        <div className="flex items-center gap-2">
          <Input id="routine-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          {savingName && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                {entry.exercise.images[0] ? (
                  <img
                    src={exerciseImageUrl(entry.exercise.images[0])}
                    alt=""
                    className="size-11 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-11 shrink-0 rounded-md bg-muted" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.exercise.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExercise(entry.id)}
                  aria-label="Elimină exercițiul"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor={`sets-${entry.id}`}>Seturi</Label>
                  <Input
                    id={`sets-${entry.id}`}
                    type="number"
                    inputMode="numeric"
                    defaultValue={entry.target_sets}
                    onBlur={(e) => updateEntry(entry.id, { target_sets: Number(e.target.value) || 1 })}
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor={`reps-${entry.id}`}>Reps țintă</Label>
                  <Input
                    id={`reps-${entry.id}`}
                    type="number"
                    inputMode="numeric"
                    defaultValue={entry.target_reps_max ?? ''}
                    onBlur={(e) =>
                      updateEntry(entry.id, { target_reps_max: e.target.value ? Number(e.target.value) : null })
                    }
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor={`rest-${entry.id}`}>Pauză (s)</Label>
                  <Input
                    id={`rest-${entry.id}`}
                    type="number"
                    inputMode="numeric"
                    defaultValue={entry.rest_seconds}
                    onBlur={(e) => updateEntry(entry.id, { rest_seconds: Number(e.target.value) || 60 })}
                    className="h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
        Adaugă exercițiu
      </Button>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} keepOpenOnSelect />
    </div>
  );
}
