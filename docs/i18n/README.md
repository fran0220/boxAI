# BoxAI i18n process

Runtime source of truth: `frontend/src/i18n/locales/{en,zh,vi}/**/*.ts`.

Ledger / glossary under this directory track **review status** and **terminology**; they do not replace runtime files.

## Supported locales

| Code | UI | Default detection | Compliance legal docs |
|------|----|-------------------|------------------------|
| `en` | Yes | Fallback | English |
| `zh` | Yes | `navigator` starts with `zh` | Chinese |
| `vi` | Yes | `navigator` starts with `vi` | **Falls back to English** (frozen Sub2API wording) |

Storage: write `boxai_locale`; read also legacy `sub2api_locale`.

## Status machine (ledger)

```
missing → draft → reviewed → approved
```

| Status | Meaning |
|--------|---------|
| `missing` | No vi yet, or vi still equals English scaffold |
| `draft` | Agent translated carefully; awaiting human spot-check |
| `reviewed` | Human edited or confirmed tone |
| `approved` | Production-ready for that key/module |

## Tools

```bash
# From repo root
python3 tools/i18n/parity_check.py --locales en,zh,vi
python3 tools/i18n/export_ledger.py --module landing --out docs/i18n/ledger/landing.jsonl
python3 tools/i18n/status_report.py --write docs/i18n/progress.md
python3 tools/i18n/extract_hardcoded.py --path frontend/src/views
```

Import path (optional, after external review of JSONL):

```bash
python3 tools/i18n/import_ledger.py --in docs/i18n/ledger/landing.jsonl --locale vi
```

Prefer editing `locales/vi/**/*.ts` directly for Agent translation waves; re-export ledger for audit.

## Rules

1. **English is the primary source**; Chinese is a semantic cross-check.
2. Preserve placeholders `{name}`, HTML structure in onboarding strings, and reason codes untranslated.
3. Product name `BoxAI`, model names, env var names: do not translate.
4. Do not bulk machine-translate dumps into `vi` and mark `approved`.
5. Admin compliance phrases and `docs/legal/*` stay frozen Sub2API bilingual (en/zh only).

## Waves

See [waves.md](./waves.md). Progress: [progress.md](./progress.md). Glossary: [GLOSSARY.md](./GLOSSARY.md).
