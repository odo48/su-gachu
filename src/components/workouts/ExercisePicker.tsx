'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exerciseImageUrl } from '@/lib/workouts/images';
import type { Exercise } from '@/lib/workouts/types';

const ANY = '__any__';

export type ExerciseSummary = Pick<Exercise, 'id' | 'name' | 'category' | 'equipment' | 'primary_muscles' | 'images'>;

export default function ExercisePicker({
  open,
  onClose,
  onSelect,
  keepOpenOnSelect = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseSummary) => void;
  keepOpenOnSelect?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [results, setResults] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Facet options loaded once per open — cheap (two columns, ~800 rows) and
  // avoids hardcoding the dataset's muscle/equipment vocabulary here.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from('exercises')
      .select('primary_muscles, equipment')
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMuscles(Array.from(new Set(data.flatMap((r) => r.primary_muscles ?? []))).sort());
        setEquipmentOptions(
          Array.from(new Set(data.map((r) => r.equipment).filter((e): e is string => !!e))).sort()
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      let q = supabase
        .from('exercises')
        .select('id, name, category, equipment, primary_muscles, images')
        .order('name', { ascending: true })
        .limit(50);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      if (muscle) q = q.contains('primary_muscles', [muscle]);
      if (equipment) q = q.eq('equipment', equipment);
      const { data } = await q;
      if (!cancelled) {
        setResults(data ?? []);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, muscle, equipment, supabase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border px-5 pb-3 pt-1">
          <h2 className="text-lg font-bold">Alege exercițiu</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Închide" className="size-9">
            <X />
          </Button>
        </div>

        <div className="space-y-3 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Caută după nume..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Caută exercițiu"
            />
          </div>
          <div className="flex gap-2">
            <Select value={muscle ?? ANY} onValueChange={(v) => setMuscle(v === ANY ? null : v)}>
              <SelectTrigger className="h-11" aria-label="Filtrează după grupă musculară">
                <SelectValue placeholder="Orice mușchi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Orice mușchi</SelectItem>
                {muscles.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={equipment ?? ANY} onValueChange={(v) => setEquipment(v === ANY ? null : v)}>
              <SelectTrigger className="h-11" aria-label="Filtrează după echipament">
                <SelectValue placeholder="Orice echipament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Orice echipament</SelectItem>
                {equipmentOptions.map((eq) => (
                  <SelectItem key={eq} value={eq}>
                    {eq}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Se caută...</p>}
          {!loading && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Niciun exercițiu găsit.</p>
          )}
          <ul className="space-y-1.5">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(ex);
                    if (!keepOpenOnSelect) onClose();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted"
                >
                  {ex.images[0] ? (
                    <img
                      src={exerciseImageUrl(ex.images[0])}
                      alt=""
                      className="size-11 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="size-11 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ex.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ex.primary_muscles.join(', ') || ex.category}
                    </p>
                  </div>
                  {ex.equipment && (
                    <Badge variant="outline" className="hidden shrink-0 text-xs sm:inline-flex">
                      {ex.equipment}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
