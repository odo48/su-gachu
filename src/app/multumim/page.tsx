import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PublicShell from '@/components/PublicShell';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Mulțumim',
  description: 'Contul Su Gachu e creat. Verifică emailul și intră în aplicație.',
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/multumim` },
};

export default function ThanksPage() {
  return (
    <PublicShell>
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Mulțumim</h1>
          <p className="text-sm text-muted-foreground">
            Contul e creat. Verifică emailul dacă e cerut confirmarea, apoi intră în dashboard. Chat-ul răspunde de
            obicei sub un minut.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
            Intră în cont
          </Link>
          <Link href="/faq" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
            Întrebări frecvente
          </Link>
        </CardContent>
      </Card>
    </PublicShell>
  );
}
