import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Coach',
  description: 'Nutriție și antrenament ghidate de AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        {children}
        <p className="mx-auto max-w-3xl px-4 pb-8 text-xs text-neutral-400">
          Informativ, nu sfat medical. Consultă un medic înainte de un deficit caloric agresiv.
        </p>
      </body>
    </html>
  );
}
