import type { Metadata } from 'next';
import { Lora, Raleway } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const raleway = Raleway({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AI Coach',
  description: 'Nutriție și antrenament ghidate de AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={cn(raleway.variable, lora.variable, 'font-sans')}>
      <body>
        {children}
        <p className="mx-auto max-w-4xl px-4 pb-8 text-xs text-muted-foreground">
          Informativ, nu sfat medical. Consultă un medic înainte de un deficit caloric agresiv.
        </p>
        <Toaster />
      </body>
    </html>
  );
}
