# i18n progress

Last updated: 2026-07-15 (feat/i18n-vi-full engineering + Wave A partial)

| Area | Status |
|------|--------|
| Worktree `feat/i18n-vi-full` | done |
| `localeMeta` + LocaleCode `vi` | done |
| Browser default `vi*` → vi | done |
| Storage `boxai_locale` (+ legacy read/write) | done |
| Batch Image → standard i18n | done (agent skill still locale-split en/zh) |
| Binary locale branches (core paths) | done |
| en/zh/vi leaf key parity CI | done (32 i18n tests green) |
| Email `vi` official templates (13 events) | done |
| Glossary | draft locked |
| Wave A landing | **vi translated** |
| Wave A common | **partial** (nav/auth/common buttons) — remaining English scaffold |
| Wave B dashboard | scaffold (en copy) |
| Wave C misc | scaffold (en copy) |
| Wave D–F admin | scaffold (en copy) |
| Wave G email | **vi done** |
| Wave H hardcoded sweep | partial (Batch Image) |

## Notes

- Runtime vi scaffold mirrors en for untranslated modules so the app never blanks; mark status `missing` until carefully translated.
- Compliance UI: vi uses **English** frozen Sub2API legal wording.
- Do not claim 100% Vietnamese UI until admin waves are translated and reviewed.
