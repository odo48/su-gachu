'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import RoutineList, { type RoutineSummary } from './RoutineList';
import ProgressPanel from './ProgressPanel';

export type HistoryRow = {
  id: number;
  name: string;
  startedAt: string;
  exerciseCount: number;
  setCount: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function WorkoutsTabs({
  userId,
  activeWorkout,
  history,
  routines,
}: {
  userId: string;
  activeWorkout: { id: number; name: string } | null;
  history: HistoryRow[];
  routines: RoutineSummary[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function startBlankWorkout() {
    setStarting(true);
    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, name: 'Antrenament' })
      .select()
      .single();
    setStarting(false);
    if (error || !data) return;
    router.push(`/workouts/${data.id}`);
  }

  return (
    <Tabs defaultValue="start" className="w-full">
      <TabsList>
        <TabsTrigger value="start">Start</TabsTrigger>
        <TabsTrigger value="history">Istoric</TabsTrigger>
        <TabsTrigger value="routines">Rutine</TabsTrigger>
        <TabsTrigger value="progress">Progres</TabsTrigger>
      </TabsList>

      <TabsContent value="start" className="space-y-4">
        {activeWorkout ? (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Antrenament în curs</p>
                <p className="font-semibold">{activeWorkout.name}</p>
              </div>
              <Link href={`/workouts/${activeWorkout.id}`} className={cn(buttonVariants())}>
                <Play className="size-4" />
                Continuă
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Începe un antrenament gol sau pornește de la o rutină salvată din tab-ul Rutine.
              </p>
              <Button type="button" className="w-full" onClick={startBlankWorkout} disabled={starting}>
                {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Începe antrenament gol
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun antrenament finalizat încă.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/workouts/${h.id}`}>
                  <Card className="transition-shadow duration-200 hover:shadow-lg">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(h.startedAt)}</p>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {h.exerciseCount} exerciții
                      </Badge>
                      <Badge variant="outline" className="tabular-nums">
                        {h.setCount} seturi
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="routines">
        <RoutineList userId={userId} initialRoutines={routines} hasActiveWorkout={!!activeWorkout} />
      </TabsContent>

      <TabsContent value="progress">
        <ProgressPanel userId={userId} />
      </TabsContent>
    </Tabs>
  );
}
