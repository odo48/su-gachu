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
   `supabase/20260826_enable_banking_credentials.sql`,
   apoi restul migrărilor datate în ordine cronologică (`supabase/20260826_*` …
   `supabase/20260830_gmail_connections.sql`, `supabase/20260909_apple_health.sql`), apoi
   `supabase/schema_workouts.sql`, `supabase/20260915_add_workout_module_type.sql` (execuție
   separată — vezi nota din fișier despre enum-uri Postgres), `supabase/20260915_seed_workout_module.sql`.
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

## Apple Watch (Shortcut)

Apple Health nu are API de server — datele nu pleacă de pe iPhone fără un app
nativ. Ocolire, fără cont Apple Developer: un **Shortcut** pe iPhone citește
metricile zilei + stadiile de somn și le trimite la `/api/apple-health/ingest`.

1. Rulează `supabase/20260909_apple_health.sql`.
2. Construiește Shortcut-ul „Su Gachu Health Sync" din
   [`docs/apple-health-shortcut.md`](docs/apple-health-shortcut.md) (sau importă
   `public/shortcuts/su-gachu-health-sync.shortcut` — best-effort), partajează-l
   pe iCloud și pune linkul în `NEXT_PUBLIC_APPLE_HEALTH_SHORTCUT_URL`.
3. Profil → **Conectează Apple Watch** → copiază `INGEST_URL` + `TOKEN` în
   cele două câmpuri Text din capul Shortcut-ului.
4. Dashboard (tab Sănătate) → **Sincronizează Apple Watch** (deschide
   Shortcut-ul via `shortcuts://x-callback-url` și revine în PWA).

Auth e un token per-user; stocăm doar `sha256` (fără Vault). Rândurile intră în
`apple_health_daily_biometrics` (raw) și, prin `src/lib/biometrics/translate.ts`,
în `daily_biometrics` (comun). Limite: fără detaliu per-antrenament, fără serii
HR de rezoluție mare; se sincronizează doar când userul apasă butonul.

## Open Food Facts (nutriție + poze produse)

Gratuit, fără cheie. `GET /api/food/search?q=iaurt grecesc` → produse cu macros/100g + poză.
Folosit pentru logarea meselor din magazin (Lidl/Kaufland) și scanare cod de bare.

## Antrenamente (workout tracker)

Loghezi antrenamente (exerciții + seturi/reps/greutate), salvezi rutine reutilizabile
și vezi progresul (recorduri, volum per grupă musculară). Modul de bază, pornit
implicit pentru toți userii (ca `food`), nu integrare opțională.

Catalogul de exerciții (~870, din **Free Exercise DB** — yuhonas/free-exercise-db,
Unlicense/public domain) e importat o singură dată în propriul proiect Supabase, nu
citit live de la GitHub:

1. Rulează `supabase/schema_workouts.sql` (creează tabelele + bucket-ul Storage
   `exercise-images`), apoi cele două migrări `20260915_*_workout_module*.sql`.
2. `npm run import:exercises` (citește `.env.local` — are nevoie de
   `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Descarcă
   `exercises.json` + pozele de la GitHub o singură dată și le scrie în tabela
   `exercises` + bucket-ul `exercise-images`. Idempotent — un rerun sare peste
   pozele deja încărcate.

După import, aplicația nu mai contactează GitHub — căutarea (`/workouts`, tab
Rutine → alege exercițiu) interoghează direct tabela `exercises` din Supabase.

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
  sincronizare zilnică prin `POST /api/biometrics/sync`. Garmin și Apple Watch
  (vezi secțiunile de mai sus) alimentează același tabel comun `daily_biometrics`.
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
    login/ profile/ dashboard/ workouts/
    api/recommend/      → Gemini
    api/garmin/webhook/ → push Garmin (stub)
    api/food/search/    → Open Food Facts
  components/  → WeightChart, RecommendButton, DailyMetricsForm
    workouts/  → ActiveWorkout, ExercisePicker, RoutineBuilder, ProgressPanel
  lib/
    nutrition.ts        → TDEE + macros (determinist)
    openfoodfacts.ts
    workouts/            → tipuri, queries Supabase, progres (1RM/volum, determinist)
    supabase/{client,server,middleware}.ts
  data/recipes.json
scripts/import-exercise-db.mjs → import unic Free Exercise DB → Supabase
supabase/schema.sql
```

## Note

- `recipes.json` are macros doar pe rețetă (din PDF), nu per ingredient. Pentru recalcul
  când schimbi gramaje, leagă fiecare ingredient la Open Food Facts.
- Informativ, nu sfat medical.
```
# su-gachu
