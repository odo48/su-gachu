'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function DeleteWorkoutButton({ workoutId }: { workoutId: number }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    await supabase.from('workouts').delete().eq('id', workoutId);
    router.push('/workouts');
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={confirming ? 'destructive' : 'ghost'}
      size="sm"
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      disabled={busy}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      {confirming ? 'Confirmă ștergerea' : 'Șterge'}
    </Button>
  );
}
