import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'Su Gachu',
  description: 'Nutriție și antrenament ghidate de AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <nav className="nav-shell">
            <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-1">
              <Link href="/dashboard" className="mr-4 flex items-center gap-2">
                <span className="nav-brand">Su Gachu</span>
              </Link>

              <Link href="/dashboard" className="nav-link">
                Dashboard
              </Link>
              <Link href="/chat" className="nav-link flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </Link>

              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <Link href="/profile" className="nav-link flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </Link>
              </div>
            </div>
          </nav>

          <main className="mx-auto max-w-4xl px-4 py-6 min-h-[calc(100vh-56px)]">
            {children}
          </main>

          <footer className="text-center py-4 text-xs text-muted-foreground">
            Informativ, nu sfat medical.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
