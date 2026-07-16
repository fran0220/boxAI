# BoxAI Brand System

**Positioning:** Intelligence, out of the box — a multi-model AI API gateway for teams and developers.

This document is the brand source of truth for the BoxAI product surface. Runtime site name/logo can still be overridden by admin settings; defaults and marketing assets follow this guide.

## Name

| Form | Usage |
|------|--------|
| **BoxAI** | Official product name (one word, capital **B** + **AI**) |
| `BoxAI - AI API Gateway` | Default document / browser title |
| Avoid | `Box AI`, `boxai`, `BoxAi`, `BOXAI` in prose |

Title pattern in the app: `{Page Title} - {SiteName}` via `frontend/src/router/title.ts`.

Constants live in:

| Layer | Path |
|-------|------|
| Frontend | `frontend/src/constants/brand.ts` — import `BRAND_NAME` / `BRAND_TAGLINE` instead of hard-coding defaults |
| Backend | `backend/internal/branding` — import `branding.ProductName` (etc.); mark upstream call sites with `// BOXAI:` |

**Prefer seed/settings over code** for runtime site name/logo when an admin override already exists. Migration seeds for BoxAI defaults use `backend/migrations/9xx_boxai_*.sql` only.

## Voice

- Confident, technical, concise.
- Emphasize: one key, multi-model routing, quota/billing control, reliability.
- Do not claim affiliation with Anthropic, OpenAI, Google, or xAI.
- Do not remove legal disclaimers or imply commercial authorization from upstream Sub2API authors.

## Logo

| Asset | Path | Notes |
|-------|------|--------|
| Full color (SVG) | `frontend/public/logo.svg`, `web/public/logo.svg` | Teal→cyan gradient open cube + routing nodes |
| Raster favicon/app | `web/public/logo.png` | 512×512 RGBA export for PNG consumers |
| Monochrome | `*/public/logo-mono.svg` | `currentColor` mark for inverse surfaces |

**Concept:** isometric open cube (“box”) with an emergent spark and three fan-out nodes (gateway routing). Clear at 16–32px favicon sizes.

**Clear space:** keep at least ~1/8 of the mark width free around the logo. Do not stretch, recolor outside the brand palette for the full-color mark, or add drop shadows that obscure the open cavity.

## Color

**Single source of truth:** `frontend/src/styles/tokens.css` and `web/src/index.css` share the same `--bx-*` palette (teal → cyan).  
Console + marketing/Creator stay dark-first on one color system.

| Token | Hex / value | Role |
|-------|-------------|------|
| `--bx-bg` | `#080a0d` | Page background (product default) |
| `--bx-bg-elevated` | `#0c1013` | Sidebar / header / elevated panels |
| `--bx-bg-card` | `rgba(255,255,255,0.035)` | Cards / tables |
| `--bx-text` | `#f4f5f7` | Primary text |
| `--bx-teal` / CTA | `#2dd4bf` → `#22d3ee` | Brand / CTA gradient |
| `--bx-primary` | `#14b8a6` | Solid primary |
| `--bx-accent` | `#06b6d4` | Cyan accent |
| `primary-500` | `#14b8a6` | Tailwind primary (compat) |

Gradients: `--bx-grad-cta` / `--bx-grad-hero` (`#2dd4bf → #22d3ee` / hero multi-stop).

**Do not use purple/violet as brand.** Keep marketing, Creator, and console on teal–cyan.

**Default theme:** dark. Light is an explicit user toggle fallback on console (`html:not(.dark)` in `tokens.css`).

## Typography

- **Marketing / Creator (`web/`):** Space Grotesk (Latin / display) + Noto Sans SC (CJK)
- **Console (`frontend/`):** Noto Sans SC + system / PingFang SC / Microsoft YaHei
- Code / terminal demos: `ui-monospace` stack
- Marketing H1: extrabold, tracking-tight, optional gradient text on the product name

## Marketing + Creator surface

Public marketing and Creator UI: React app on **`you-box.com`** (`web/`).

- Routes: `/`, `/studio`, `/pricing`, `/create/*` (image · video · assets), `/login`, `/account`
- Tokens: `--bx-*` in `web/src/index.css` (aligned with console)
- Creator shell: `CreateLayout` + workspace primitives (`.bx-create-*`)
- Image workbench: vendored playground under `web/src/image-playground` (teal primary HSL)
- Constants: `web/src/lib/brand.ts` (same names as `frontend/src/constants/brand.ts`)

Console shell on **`console.you-box.com`**: `AppLayout` / `AuthLayout` use `bx-page` + `bx-ambient-mesh`. See `docs/design-unification-ledger.md`.

Topology: [WEB_PLATFORM.md](./WEB_PLATFORM.md).
