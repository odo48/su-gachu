import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import PublicShell from '@/components/PublicShell';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <PublicShell>
      <div className="flex min-h-[50vh] flex-col justify-center">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Pagina nu există</h1>
            <p className="text-sm text-muted-foreground">Link-ul e greșit sau pagina a fost mutată.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={cn(buttonVariants(), 'flex-1')}>
              Intră în cont
            </Link>
            <Link href="/faq" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
              Întrebări frecvente
            </Link>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
