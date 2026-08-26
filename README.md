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
`npm run audit` pentru vulnerabilități high/critical în dependențe.

Pagini publice: `/login`, `/faq`, `/confidentialitate`, `/multumim`, `/robots.txt`, `/sitemap.xml`.

## Supabase

1. supabase.com → proiect nou.
2. SQL Editor → rulează în ordine: `supabase/schema.sql`, `supabase/20260825_schema_oauth.sql`,
   `supabase/schema_chat.sql`, `supabase/schema_food.sql`, `supabase/schema_modules.sql`,
   `supabase/20260825_fix_auth_signup.sql`,    `supabase/schema_home_assistant.sql`, `supabase/schema_biometrics.sql`,
   `supabase/schema_financial.sql`, `supabase/20260826_garmin_connect.sql`,
   `supabase/20260826_enable_banking_sessions.sql`,
   `supabase/20260826_enable_banking_credentials.sql`.
3. Authentication → Providers → activează **Email** (pentru dev, dezactivează „Confirm email").
4. Settings → API → copiază URL, anon key, service_role key în `.env.local`.

Vault (folosit pentru token-urile Home Assistant/Ultrahuman, vezi mai jos) e activat
implicit pe proiectele Supabase noi — nu necesită pași suplimentari.

## Gemini

`aistudio.google.com` → API key → `GEMINI_API_KEY` în `.env.local` (DOAR server-side).
Model folosit: `gemini-2.5-flash`. Numerele (calorii/macros) se calculează determinist
în `src/lib/nutrition.ts`; Gemini doar alege mese și argumentează.

## Flux

1. `/login` → cont.
2. `/profile` → completezi greutate, înălțime, dată naștere, **cap calorii 1500**, greutate țintă.
3. `/dashboard` → introduci metricile zilei → „Generează planul zilei" (cheamă `/api/recommend`).

## Garmin

Login **Garmin Connect** (email + parolă, ca în jarvis-brain/garth), per user, pe `/profile`.
Parola și sesiunea OAuth stau în Vault (`supabase/20260826_garmin_connect.sql`).

1. Rulează migrarea `supabase/20260826_garmin_connect.sql`.
2. Profil → Conectează Garmin cu emailul/parola de pe connect.garmin.com.
3. Dashboard → **Sincronizează Garmin** (ultimele 7 zile → `daily_metrics`).

Dacă Garmin cere MFA/2FA, login-ul neoficial poate eșua — același limit ca la garth fără prompt interactiv.

Webhook-ul `/api/garmin/webhook` e doar pentru Health API oficial (parteneriat), nu pentru fluxul ăsta.
Setează `GARMIN_WEBHOOK_SECRET` — fără el, endpoint-ul răspunde 401.

## Open Food Facts (nutriție + poze produse)

Gratuit, fără cheie. `GET /api/food/search?q=iaurt grecesc` → produse cu macros/100g + poză.
Folosit pentru logarea meselor din magazin (Lidl/Kaufland) și scanare cod de bare.

## Jarvis (portare în curs)

Domeniile portate din jarvis (vezi `/Users/lucy/projects/jarvis`) rulează toate în acest
Next.js, fără microserviciu separat. Fiecare domeniu e activabil per-user prin tabela
`user_modules` (`food` pornit implicit; restul, doar după conectare).

- **Chat unificat**: `/api/conversations/[id]/messages` trece prin `src/lib/agents/router.ts`,
  care expune fiecare agent activat ca tool către modelul principal — echivalentul
  `BrainService`-ului din jarvis-brain, dar cu registry+behavior într-un singur fișier
  (`src/lib/agents/registry.ts`) în loc de `agent_registry.py` + `base_agent.py` separate.
- **Home Assistant**: fiecare user își conectează propria instanță (`POST /api/home-assistant/connection`
  cu `mcpUrl` + long-lived token). Spre deosebire de restul domeniilor, tool-urile sunt
  descoperite dinamic de la serverul MCP al HA-ului, via clientul MCP generic
  `src/lib/mcp/client.ts` (folosit și de Tavily, vezi mai jos).
- **Biometrics**: conectare Ultrahuman prin `POST /api/biometrics/connection` (`{token}`),
  sincronizare zilnică prin `POST /api/biometrics/sync`.
- **Financial**: fiecare user își pune App ID + cheia PEM din Enable Banking Control Panel
  pe tab-ul Bancă din `/dashboard` (sau `/profile`), apoi leagă banca
  (`POST /api/enable-banking/auth` → callback). Cheia stă în Vault, nu în env.
  În Control Panel, whitelist `{origin}/api/enable-banking/callback`.
- Token-urile per-user (Home Assistant, Ultrahuman) trec prin Supabase Vault
  (`supabase/schema_home_assistant.sql`, `supabase/schema_biometrics.sql`) — niciodată
  într-o coloană în clar.
- **Tavily** (căutare web, `src/lib/mcp/tavily.ts`): în jarvis era `module: "general"`,
  adică disponibil pentru toate agentele, nu doar food. Portat la fel — `combineTools()`
  (`src/lib/ai/combine-tools.ts`) adaugă tool-urile Tavily peste tool-urile fiecărui
  agent (food/HA/biometrics/financial) și peste router. Credențial la nivel de
  aplicație (`TAVILY_API_KEY`), nu per-user.

Integrările (Garmin, Ultrahuman, bancă, Home Assistant) se conectează din `/profile`.

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
