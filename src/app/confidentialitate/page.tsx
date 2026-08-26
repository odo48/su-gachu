import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import PublicShell from '@/components/PublicShell';

export const metadata: Metadata = {
  title: 'Politica de confidențialitate',
  description: `Cum ${SITE_NAME} folosește datele de cont, sănătate și bancă. Nu vindem datele tale.`,
  alternates: { canonical: `${SITE_URL}/confidentialitate` },
  openGraph: { url: `${SITE_URL}/confidentialitate` },
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <article>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Politica de confidențialitate</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ultima actualizare: 26 august 2026</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed">
        <p>
          {SITE_NAME} ({SITE_URL}) e un antrenor AI personal. Operatorul prelucrează datele tale ca să-ți ofere
          recomandări de nutriție, antrenament, somn și o privire asupra cheltuielilor.
        </p>
        <h2 className="font-heading pt-2 text-xl font-semibold">Ce date folosim</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cont: email, nume, profil (greutate, înălțime, obiectiv).</li>
          <li>Sănătate: metrici Garmin / Ultrahuman pe care le sincronizezi tu.</li>
          <li>Financiare: solduri și tranzacții după consimțământ PSD2, plus App ID / cheie PEM pe care le salvezi tu.</li>
          <li>Mesaje din chat, necesare ca asistentul să răspundă.</li>
        </ul>
        <h2 className="font-heading pt-2 text-xl font-semibold">Unde stau secretele</h2>
        <p>
          Parolele Garmin, token-urile Ultrahuman / Home Assistant și cheia Enable Banking sunt ținute în Supabase
          Vault, nu în coloane în clar. Cheile de model (Gemini etc.) sunt doar pe server, nu în browser.
        </p>
        <h2 className="font-heading pt-2 text-xl font-semibold">Cu cine partajăm</h2>
        <p>
          Nu vindem date. Trimitem prompturi către furnizorii de AI (ex. Google Gemini) ca să genereze răspunsuri.
          Banca vede doar consimțământul PSD2 prin Enable Banking. Nu publicăm hărți sau date de localizare.
        </p>
        <h2 className="font-heading pt-2 text-xl font-semibold">Păstrare și drepturi</h2>
        <p>
          Poți deconecta integrările din Profil. Pentru acces, rectificare sau ștergere, scrie din chat sau la adresa de
          pe pagina de cont. Poți depune plângere la ANSPDCP.
        </p>
        <p className="text-muted-foreground">
          Informativ, nu sfat medical sau financiar. Consultă un specialist când e nevoie.
        </p>
      </div>
      </article>
    </PublicShell>
  );
}
