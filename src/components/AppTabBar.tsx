'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageCircle, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p.startsWith('/dashboard') },
  { href: '/chat', label: 'Chat', icon: MessageCircle, match: (p: string) => p.startsWith('/chat') },
  { href: '/profile', label: 'Profil', icon: UserRound, match: (p: string) => p.startsWith('/profile') },
] as const;

export default function AppTabBar() {
  const path = usePathname() || '';
  const isApp = path.startsWith('/dashboard') || path.startsWith('/chat') || path.startsWith('/profile');
  if (!isApp) return null;

  return (
    <nav
      aria-label="Navigare aplicație"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="grid h-14 grid-cols-3">
        {LINKS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
