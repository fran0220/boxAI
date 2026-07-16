# Vendored: gpt_image_playground

| Item | Value |
|------|--------|
| Upstream | [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) |
| License | MIT — see `LICENSE.upstream` |
| Version baseline | v0.7.0 (main @ clone time) |
| Embed surface | BoxAI Creator `/create/image` |

## BoxAI patches (do not drop on re-vendor)

1. `lib/boxaiAuth.ts` — session JWT at call time; origin-gated Authorization
2. `lib/boxaiBridge.ts` — assets-db mirror + reference handoff
3. `lib/openaiCompatibleImageApi.ts` / `lib/agentApi.ts` — auth headers via `resolveAuthHeaders(url)`
4. `lib/apiProfiles.ts` — lock profiles to BoxAI gateway; validate via session
5. `hooks/useVersionCheck.ts` — no-op (no GitHub poll)
6. `components/Header.tsx` — BoxAI title, `top-12` under CreateLayout, no PWA install
7. `components/InputBar.tsx` — submit gate via `validateApiProfile` (session JWT)
8. Settings UI removed entirely (no SettingsModal / API / habit tabs)
9. `store.ts` — gallery/agent modes force platform models (`gpt-image-2` / `gpt-5.4`)
10. `index.css` — BoxAI brand skin: teal primary, --bx-* surfaces, rect buttons, focus rings (console-aligned)
11. `BoxaiPlaygroundRoot.tsx` — mount shell

## Re-vendor checklist

1. Copy upstream `src/` over this tree (exclude tests).
2. Re-apply patches above (prefer `git apply` / three-way merge).
3. Keep `LICENSE.upstream` and this file.
4. `pnpm install && pnpm typecheck && pnpm test:run` in `web/`.
