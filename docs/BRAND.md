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
| Full color (SVG) | `frontend/public/logo.svg` | Source of truth; teal→cyan gradient open cube + routing nodes |
| Raster favicon/app | `frontend/public/logo.png` | 512×512 RGBA export for PNG consumers |
| Monochrome | `frontend/public/logo-mono.svg` | `currentColor` mark for inverse surfaces |

**Concept:** isometric open cube (“box”) with an emergent spark and three fan-out nodes (gateway routing). Clear at 16–32px favicon sizes.

**Clear space:** keep at least ~1/8 of the mark width free around the logo. Do not stretch, recolor outside the brand palette for the full-color mark, or add drop shadows that obscure the open cavity.

## Color

Aligned with existing Tailwind `primary` scale (do not invent a parallel palette):

| Token | Hex | Role |
|-------|-----|------|
| `primary-500` | `#14b8a6` | Brand primary / CTA |
| accent cyan | `#06b6d4` | Logo / gradient highlight |
| `primary-600` | `#0d9488` | Hover / emphasis |
| `dark-950` | `#020617` | Dark surfaces |
| `dark-900` | `#0f172a` | Dark panels |

Gradients: `from-primary-500 to-cyan-500` (or `#14b8a6 → #06b6d4`).

## Typography

- UI: system / PingFang SC / Microsoft YaHei stack (see `tailwind.config.js` `fontFamily.sans`)
- Code / terminal demos: `ui-monospace` stack
- Marketing H1: extrabold, tracking-tight, optional gradient text on the product name

## Marketing surface

Default landing: `frontend/src/views/HomeView.vue`

- Wordmark + mark in header
- Gradient hero product name
- Value props (one key / multi-model / pay-as-you-go)
- Terminal demo (“boxai · gateway”)
- Feature grid, provider strip, bottom CTA
- Admin can still override via `home_content` (HTML or iframe URL)

## Compliance note (do not change casually)

Legal acknowledgment phrases in `frontend/src/stores/adminCompliance.ts` and matching backend hashes **must remain byte-stable** (currently reference “Sub2API” wording). Changing them invalidates stored admin compliance acknowledgments. Product UI copy elsewhere uses **BoxAI**.

## Upstream attribution

BoxAI product branding is applied on top of the open-source Sub2API gateway stack. Preserve LICENSE, CLA, and disclaimer sections when editing README headers.

Engineering rules for keeping brand deltas merge-friendly: [AGENTS.md](../AGENTS.md), [FORK_DELTA.md](../FORK_DELTA.md), [docs/agents/change-design.md](./agents/change-design.md).
