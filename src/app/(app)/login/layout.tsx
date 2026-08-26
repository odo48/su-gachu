import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Intră în cont',
  description:
    'Conectează-te la Su Gachu: nutriție, somn, antrenament și cheltuieli. Chat-ul răspunde de obicei sub un minut.',
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: { url: `${SITE_URL}/login` },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
