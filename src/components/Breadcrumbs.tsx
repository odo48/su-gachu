'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  profile: 'Profil',
  chat: 'Chat',
  login: 'Autentificare',
  faq: 'Întrebări frecvente',
  confidentialitate: 'Confidențialitate',
  multumim: 'Mulțumim',
};

export default function Breadcrumbs() {
  const pathname = usePathname() || '/';
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const crumbs = parts.map((part, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/');
    const label = LABELS[part] ?? (part.length > 20 ? 'Detaliu' : part);
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/dashboard" className="underline-offset-2 hover:text-foreground hover:underline">
            Acasă
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            {i === crumbs.length - 1 ? (
              <span className="text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="underline-offset-2 hover:text-foreground hover:underline">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
