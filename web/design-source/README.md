# BoxAI Design Source — Precision Teal

Single design pack for the apex product surface (`you-box.com` / `web/`).

Imported from Claude Design project:

- Project ID: `5c213057-d21a-416b-9bd5-2d4090e2f880`
- Source URL: https://claude.ai/design/p/5c213057-d21a-416b-9bd5-2d4090e2f880

## Files

| File | Role |
|------|------|
| `tokens.css` | Design tokens reference (`--bx-*`; product SoT is `web/src/index.css`) |
| `Header.dc.html` | Sticky chrome + mega-menu |
| `Footer.dc.html` | Footer |
| `00-导航.dc.html` | Design system index |
| `新版-首页.dc.html` | Marketing homepage |
| `新版-账户.dc.html` | Customer account shell + tabs |
| `support.js` | Design-canvas runtime (not shipped) |
| `web/public/logo*.svg` | Brand marks |

## Implementation notes

- Apex React SPA (`web/src`) ports these designs structurally under **one** design language: Precision Teal.
- Live product data must come from Go APIs (`customer-api`, `public-status`, session auth) — never from design placeholder numbers.
- Pages without design HTML on disk (Pricing / Studio / Status / Auth / Creator) follow Home + Account structural patterns and real APIs.

## Re-import

```bash
# Claude Code with DesignSync (or claude-design MCP after /design-login)
# get_file projectId=5c213057-d21a-416b-9bd5-2d4090e2f880 path=<file>
```
