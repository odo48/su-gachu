import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Date personale și conexiuni Garmin, Ultrahuman, bancă și Home Assistant.',
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
