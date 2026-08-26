'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartPulse, LayoutDashboard, MessageCircle, UserRound } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p.startsWith('/dashboard') },
  { href: '/chat', label: 'Chat', icon: MessageCircle, match: (p: string) => p.startsWith('/chat') },
  { href: '/profile', label: 'Profil', icon: UserRound, match: (p: string) => p.startsWith('/profile') },
] as const;

function isAppPath(path: string) {
  return path.startsWith('/dashboard') || path.startsWith('/chat') || path.startsWith('/profile');
}

export default function AppNav() {
  const path = usePathname() || '';
  const isApp = isAppPath(path);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link href={isApp ? '/dashboard' : '/login'} className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="size-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">Su Gachu</span>
        </Link>

        {isApp ? (
          <nav
            aria-label="Principal"
            className="hidden items-center rounded-full bg-background p-1 md:flex"
          >
            {LINKS.map(({ href, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'bg-muted text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sr-only sm:hidden">{label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav aria-label="Principal" className="flex items-center gap-1">
            <Link
              href="/faq"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'h-11 px-3',
                path === '/faq' && 'bg-accent text-accent-foreground'
              )}
            >
              FAQ
            </Link>
            <Link href="/login#cta" className={cn(buttonVariants({ size: 'sm' }), 'h-11 px-4')}>
              Intră în cont
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
