import Link from 'next/link';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/chat', label: 'Chat' },
  { href: '/profile', label: 'Profil' },
  { href: '/faq', label: 'Întrebări frecvente' },
  { href: '/confidentialitate', label: 'Confidențialitate' },
];

export default function SiteFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-4xl px-4 pb-24 pt-8 text-sm text-muted-foreground md:pb-8">
      <nav aria-label="Linkuri site" className="flex flex-wrap gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="underline-offset-2 hover:text-foreground hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs">
        Răspuns în chat de obicei sub un minut. Informativ, nu sfat medical. Consultă un medic înainte de un deficit
        caloric agresiv.
      </p>
    </footer>
  );
}
