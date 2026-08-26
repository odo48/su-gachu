# Su Gachu — Claude / agent notes

Next.js 15 app (AI Coach): nutrition, chat, Home Assistant, biometrics, banking. Stack: Tailwind + shadcn/ui + Supabase.

## Design system

Read `design-system/MASTER.md` before UI work. If `design-system/pages/<page>.md` exists, it overrides Master.

Tokens: dark canvas `#0C1215`, emerald CTA `#10B981`, teal `#21A38A`, text `#E8F1F1`. Fonts: Lora (headings), Raleway (body).

## UI

Always Tailwind utilities + shadcn from `src/components/ui`. Add missing pieces with `npx shadcn@latest add <name>`. Lucide icons (or official Google/Apple SVGs). `Toaster` only in root layout. Labels on inputs. Disable buttons while async.

## Migrations

`supabase/schema.sql` is bootstrap only. Incremental SQL goes in `supabase/YYYYMMDD_name.sql` with `Created: YYYY-MM-DD` in the header. Prefer idempotent statements. Run order is in README. Do not re-run `schema.sql` on an existing project. RLS on user tables; Vault functions executable by `service_role` only.

## Code style

Match existing TypeScript, keep comments that explain non-obvious intent, don’t add docs the user didn’t ask for.
