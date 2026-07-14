#!/usr/bin/env python3
"""
Apply vi (or other) strings from a JSONL ledger into a generated locale patch file.

Full nested TS rewrite of hand-maintained modules is fragile; this writes:
  docs/i18n/ledger/applied_<locale>.json  (flat key→value)
and updates docs/i18n/ledger/status.json from row status fields.

Prefer direct edits to locales/vi/** during Agent waves; use this for external review re-import.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from locale_lib import REPO_ROOT, die, placeholders  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="inp", required=True)
    parser.add_argument("--locale", default="vi")
    args = parser.parse_args()

    path = Path(args.inp)
    if not path.exists():
        die(f"not found: {path}")

    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))

    flat: dict[str, str] = {}
    status: dict[str, str] = {}
    errors = 0
    for row in rows:
        key = row["key"]
        val = row.get(args.locale) or row.get("vi") or ""
        en = row.get("en") or ""
        ph_en = set(placeholders(en))
        ph_val = set(placeholders(val))
        if ph_en != ph_val:
            print(f"placeholder mismatch {key}: en={sorted(ph_en)} {args.locale}={sorted(ph_val)}")
            errors += 1
            continue
        flat[key] = val
        if row.get("status"):
            status[key] = row["status"]

    if errors:
        die(f"{errors} rows failed placeholder check")

    out_flat = REPO_ROOT / "docs" / "i18n" / "ledger" / f"applied_{args.locale}.json"
    out_flat.write_text(json.dumps(flat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    status_path = REPO_ROOT / "docs" / "i18n" / "ledger" / "status.json"
    existing = {}
    if status_path.exists():
        existing = json.loads(status_path.read_text(encoding="utf-8"))
    existing.update(status)
    status_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {len(flat)} strings → {out_flat}")
    print(f"updated statuses → {status_path}")
    print("NOTE: merge applied_*.json into locales/vi manually or with a follow-up codegen step.")


if __name__ == "__main__":
    main()
