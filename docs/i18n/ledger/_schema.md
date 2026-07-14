# Ledger schema

Each module file is JSONL (one JSON object per line) or a JSON array.

```json
{
  "key": "home.heroLine1",
  "module": "landing",
  "en": "One box.",
  "zh": "一个盒子，",
  "vi": "Một hộp.",
  "status": "draft",
  "placeholders": [],
  "notes": ""
}
```

| Field | Type | Required |
|-------|------|----------|
| `key` | string | yes |
| `module` | string | yes |
| `en` | string | yes |
| `zh` | string | yes (empty if missing in zh) |
| `vi` | string | yes (may equal en when missing) |
| `status` | `missing` \| `draft` \| `reviewed` \| `approved` | yes |
| `placeholders` | string[] | yes |
| `notes` | string | no |

Status inference when exporting:

- no vi or vi === en → `missing` (unless status override file)
- vi present and ≠ en → `draft` default (override via `docs/i18n/ledger/status.json`)
