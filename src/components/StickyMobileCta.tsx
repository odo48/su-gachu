'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StickyMobileCta() {
  const path = usePathname() || '';
  const onLogin = path === '/login';
  const publicPage =
    onLogin || path === '/faq' || path === '/confidentialitate' || path === '/multumim';
  const href = onLogin ? '#cta' : publicPage ? '/login#cta' : '/chat';
  const label = publicPage ? 'Începe gratuit' : 'Deschide chat';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
      <Link href={href} className={cn(buttonVariants(), 'w-full')}>
        {label}
      </Link>
    </div>
  );
}
