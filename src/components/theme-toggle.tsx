'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const toggleClass = cn(
  'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
  'text-primary-foreground/85 hover:text-primary-foreground hover:bg-primary-foreground/10',
  'dark:text-brand-200 dark:hover:text-white dark:hover:bg-brand-800',
);

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button type="button" className={toggleClass} aria-label="Temă">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const isDark = (theme === 'system' ? resolvedTheme : theme) === 'dark';

  return (
    <button
      type="button"
      className={toggleClass}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Mod luminos' : 'Mod întunecat'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
