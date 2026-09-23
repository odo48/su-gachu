'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RestTimer({ seconds, onDismiss }: { seconds: number; onDismiss: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || remaining <= 0) {
      if (remaining <= 0 && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200);
      return;
    }
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running, remaining]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? 'Pauză cronometru' : 'Continuă cronometru'}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        {running ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pauză între seturi</p>
        <p className={`text-2xl font-bold tabular-nums ${remaining === 0 ? 'text-primary' : ''}`}>
          {mm}:{String(ss).padStart(2, '0')}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setRemaining((r) => r + 15)}>
        +15s
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label="Închide cronometrul"
        className="size-9"
      >
        <X />
      </Button>
    </div>
  );
}
