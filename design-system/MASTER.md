# Design System Master File

> When building a page, first check `design-system/pages/[page-name].md`.
> That file **overrides** this Master. Otherwise follow this file.
> Implement with **Tailwind CSS** + **shadcn/ui** (`src/components/ui`). Do not invent parallel CSS classes.

---

**Project:** Su Gachu (AI Coach)
**Generated:** 2026-08-25
**Category:** Personal health / nutrition / fitness coach

---

## Stack

- Tailwind utility classes only — no new CSS modules, no inline `style={}` for layout/color.
- UI primitives from `src/components/ui` (Button, Input, Label, Card, Separator, Sonner). Add missing primitives with `npx shadcn@latest add <name>`.
- Icons: **Lucide** (or official brand SVGs for Google/Apple). Never emojis as icons.
- Fonts: **Lora** (headings, `--font-heading`) + **Raleway** (body, `--font-sans`), loaded in `src/app/layout.tsx`.

## Color Palette

Tokens live in `src/app/globals.css` (`--primary`, `--background`, …) and are wired in `tailwind.config.ts`. Dark-first.

| Role | Hex | Tailwind |
|------|-----|----------|
| Primary / CTA | `#10B981` | `bg-primary` `text-primary` |
| Teal accent | `#21A38A` | `bg-secondary` `text-secondary` |
| Chart cyan | `#2EC4D6` | `--chart-2` |
| Background | `#0C1215` | `bg-background` |
| Text | `#E8F1F1` | `text-foreground` |
| Card | `#151C20` | `bg-card` |

`bg-brand` is an alias of primary for older screens — prefer `bg-primary` on new work.

## Typography

- Headings (`h1–h3`): `font-heading` (Lora), semibold/bold, tracking tight.
- Body: `font-sans` (Raleway), 16px minimum on mobile, line-height 1.5–1.75.
- Page titles: `text-2xl` or `text-3xl`.

## Spacing & radius

Use Tailwind scale (`gap-2` 8px, `p-4` 16px, `p-6` 24px, `gap-8`/`py-12` for sections). Radius `--radius` = 8px (`rounded-lg` on buttons, `rounded-xl` on cards).

## Motion

- Transitions: `duration-200` (150–300ms).
- Hover: color/opacity/shadow — not layout-shifting `scale`.
- Respect `prefers-reduced-motion`.

## Components (shadcn)

| Need | Use |
|------|-----|
| Actions | `Button` (`default` = CTA green, `outline` = secondary, `ghost` / `link`) |
| Fields | `Label` + `Input` (visible labels, 16px text) |
| Grouping | `Card` |
| Dividers | `Separator` |
| Toasts | `Toaster` in root layout (Sonner) — never per-page |

Touch targets: `h-11` / 44px minimum. `cursor-pointer` on clickable elements (buttons already have it).

## Style

Calm wellness, dark ink canvas, raised cards, emerald CTAs. Subtle border on cards. Not neon, not gaming.

## Anti-patterns

- Raw `<button>` / `<input>` when a shadcn primitive exists
- Emoji icons
- Placeholder-only inputs (no `<Label>`)
- Low-contrast muted text (`text-neutral-400` on dark canvas)
- Instant state changes with no loading/disabled on async buttons

## Checklist

- [ ] shadcn primitive used
- [ ] Lucide or brand SVG icons
- [ ] Labels on inputs
- [ ] Loading + disabled on async actions
- [ ] Contrast ≥ 4.5:1
- [ ] Focus ring visible
- [ ] 375 / 768 / 1024 layouts
