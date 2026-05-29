# AI Coach

Next.js 15 + Tailwind + Supabase + Gemini. Recomandă nutriție (din `src/data/recipes.json`)
și antrenament pe baza profilului + metricilor (manual acum, Garmin după aprobare).

## Rulare locală

```bash
cd ai-coach
npm install
cp .env.local.example .env.local   # completează valorile
npm run dev                        # http://localhost:3000
```

`npm run typecheck` pentru verificarea tipurilor.

## Supabase

1. supabase.com → proiect nou.
2. SQL Editor → rulează tot `supabase/schema.sql`.
3. Authentication → Providers → activează **Email** (pentru dev, dezactivează „Confirm email").
4. Settings → API → copiază URL, anon key, service_role key în `.env.local`.

## Gemini

`aistudio.google.com` → API key → `GEMINI_API_KEY` în `.env.local` (DOAR server-side).
Model folosit: `gemini-2.5-flash`. Numerele (calorii/macros) se calculează determinist
în `src/lib/nutrition.ts`; Gemini doar alege mese și argumentează.

## Flux

1. `/login` → cont.
2. `/profile` → completezi greutate, înălțime, dată naștere, **cap calorii 1500**, greutate țintă.
3. `/dashboard` → introduci metricile zilei → „Generează planul zilei" (cheamă `/api/recommend`).

## Garmin (când ai ceasul + aprobarea)

1. `developer.garmin.com` → aplică pt Health API (durează; începe devreme).
2. La aprobare: `GARMIN_CONSUMER_KEY/SECRET` în env.
3. Înregistrează webhook-ul: `https://<domeniu>/api/garmin/webhook`.
4. Implementează OAuth 1.0a (stocare în tabelul `garmin_tokens`) și completează maparea
   câmpurilor în `src/app/api/garmin/webhook/route.ts` (vezi TODO).

## Open Food Facts (nutriție + poze produse)

Gratuit, fără cheie. `GET /api/food/search?q=iaurt grecesc` → produse cu macros/100g + poză.
Folosit pentru logarea meselor din magazin (Lidl/Kaufland) și scanare cod de bare.

## Structură

```
src/
  app/
    login/ profile/ dashboard/
    api/recommend/      → Gemini
    api/garmin/webhook/ → push Garmin (stub)
    api/food/search/    → Open Food Facts
  components/  → WeightChart, RecommendButton, DailyMetricsForm
  lib/
    nutrition.ts        → TDEE + macros (determinist)
    openfoodfacts.ts
    supabase/{client,server,middleware}.ts
  data/recipes.json
supabase/schema.sql
```

## Note

- `recipes.json` are macros doar pe rețetă (din PDF), nu per ingredient. Pentru recalcul
  când schimbi gramaje, leagă fiecare ingredient la Open Food Facts.
- Informativ, nu sfat medical.
```
# su-gachu
