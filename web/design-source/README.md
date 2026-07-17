# BoxAI Design Source — Precision Teal

Single design pack for the apex product surface (`you-box.com` / `web/`).

Imported from Claude Design project:

- Project ID: `5c213057-d21a-416b-9bd5-2d4090e2f880`
- Source URL: https://claude.ai/design/p/5c213057-d21a-416b-9bd5-2d4090e2f880

## Files

Canonical tree under this folder (product ports use the local names below).

| File | Role | Product port |
|------|------|--------------|
| `tokens.css` | Design tokens (`--bx-*`; product SoT is `web/src/index.css`) | `web/src/index.css` `:root` / light |
| `Header.dc.html` | Sticky chrome + Nebius-style mega-menu | `web/src/components/Header.tsx` |
| `Footer.dc.html` | Site footer | `web/src/components/Footer.tsx` |
| `00-导航.dc.html` | Design system index / nav map | — |
| `新版-首页.dc.html` | Marketing homepage | `web/src/pages/Home.tsx` |
| `新版-账户.dc.html` | Customer account shell + tabs | `web/src/pages/account/*` |
| `新版-定价.dc.html` | Pricing | `web/src/pages/Pricing.tsx` |
| `新版-状态.dc.html` | Public service status | `web/src/pages/Status.tsx` |
| `新版-登录注册.dc.html` | Login / signup | `web/src/pages/auth/*` |
| `新版-创作台.dc.html` | Creator workspace (image/video/assets) | `web/src/pages/create/*` |
| `新版-Studio.dc.html` | Studio desktop product page | `web/src/pages/Studio.tsx` |
| `新版-设计Token.dc.html` | Token gallery / type / radius / motion | reference only |
| `support.js` | Design-canvas runtime (not shipped) | — |
| `web/public/logo.svg` | Brand mark | `web/public/logo.svg` |
| `web/public/logo-mono.svg` | Mono brand mark | `web/public/logo-mono.svg` |

### React.zip inventory

Repo-root `React.zip` (~97 KB) is the upstream design export. Filenames inside the archive may use `V2` suffixes; this folder normalizes them for product work:

| In `React.zip` | Local / product name |
|----------------|----------------------|
| `.thumbnail` | (not committed) |
| `00-导航.dc.html` | `00-导航.dc.html` |
| `HeaderV2.dc.html` | `Header.dc.html` |
| `FooterV2.dc.html` | `Footer.dc.html` |
| `tokens-v2.css` | `tokens.css` |
| `support.js` | `support.js` |
| `web/public/logo.svg` | `web/public/logo.svg` |
| `web/public/logo-mono.svg` | `web/public/logo-mono.svg` |
| `新版-首页.dc.html` | `新版-首页.dc.html` |
| `新版-账户.dc.html` | `新版-账户.dc.html` |
| `新版-定价.dc.html` | `新版-定价.dc.html` |
| `新版-状态.dc.html` | `新版-状态.dc.html` |
| `新版-登录注册.dc.html` | `新版-登录注册.dc.html` |
| `新版-创作台.dc.html` | `新版-创作台.dc.html` |
| `新版-Studio.dc.html` | `新版-Studio.dc.html` |
| `新版-设计Token.dc.html` | `新版-设计Token.dc.html` |

All screen pages from the zip are listed above; there is no separate design file for checkout/payment result (product-only routes).

## Implementation notes

- Apex React SPA (`web/src`) ports these designs under **one** language: Precision Teal.
- Core `--bx-*` values in `web/src/index.css` must match `tokens.css` exactly; product may add compat aliases (`--bx-teal*`, hex helpers, create-sidebar width, etc.).
- Live product data comes from Go APIs (`customer-api`, `public-status`, session auth) — never from design placeholder numbers (e.g. do not ship `$0.28` / `$128.50` mock figures).
- Account aside (lg+): `200px`, `padding: 32px 20px 32px 0`, active nav `font-weight: 700`.
- Creator rail: `208px` (`--bx-create-sidebar-w`), balance/counts from real APIs / local assets DB.
- Header/Footer keep product-only affordances (auth state, mobile sheet, real routes) while heights, gaps, mega structure, and zh copy track the HTML.

## Do not commit

- `**/.thumbnail` — design-tool previews
- `react-pack/` — unpack side-car (prefer root of this folder as SoT)

## Re-import

```bash
# Claude Code with DesignSync (or claude-design MCP after /design-login)
# get_file projectId=5c213057-d21a-416b-9bd5-2d4090e2f880 path=<file>
```
