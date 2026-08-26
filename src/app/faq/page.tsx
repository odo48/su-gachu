import type { Metadata } from 'next';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import PublicShell from '@/components/PublicShell';

export const metadata: Metadata = {
  title: 'Întrebări frecvente',
  description: `Răspunsuri despre ${SITE_NAME}: cont, date de sănătate, bancă, chat și confidențialitate. ${SITE_TAGLINE}`,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: { url: `${SITE_URL}/faq` },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Ce este Su Gachu?',
    a: 'Un antrenor AI pentru nutriție, somn, antrenament și cheltuieli. Îți conectezi Garmin, Ultrahuman sau banca și vorbești cu chat-ul în română.',
  },
  {
    q: 'Cât de rapid răspunde chat-ul?',
    a: 'De obicei sub un minut. Dacă o unealtă (Garmin, bancă) e lentă, poate dura câteva secunde în plus.',
  },
  {
    q: 'Datele mele merg la alți useri?',
    a: 'Nu. Conturile, metricile și tranzacțiile sunt izolate pe user (RLS). Cheile de bancă și parolele Garmin stau în Vault, nu în clar.',
  },
  {
    q: 'Trebuie să pun chei API în .env ca user?',
    a: 'Nu. Fiecare user își conectează Garmin, Ultrahuman, banca sau Home Assistant din Profil / Dashboard.',
  },
  {
    q: 'E sfat medical?',
    a: 'Nu. Conținutul e informativ. Consultă un medic înainte de un deficit caloric agresiv sau dacă ai o afecțiune.',
  },
  {
    q: 'Unde e sala / aveți hartă?',
    a: 'Su Gachu e doar o aplicație web, fără locație fizică. Nu afișăm hărți și nu cerem geolocație.',
  },
  {
    q: 'Cum șterg datele?',
    a: 'Poți deconecta Garmin, banca și celelalte integrări din Profil. Pentru ștergerea contului, scrie-ne din chat sau din pagina de confidențialitate.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function FaqPage() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Întrebări frecvente</h1>
      <p className="mt-2 text-muted-foreground">Răspuns în chat de obicei sub un minut.</p>
      <dl className="mt-8 space-y-6">
        {FAQS.map((item) => (
          <div key={item.q}>
            <dt className="font-heading text-lg font-semibold">{item.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
    </PublicShell>
  );
}
