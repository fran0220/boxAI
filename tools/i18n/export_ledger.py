#!/usr/bin/env python3
"""Export flattened en/zh/vi rows for one module or all modules as JSONL."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from locale_lib import (  # noqa: E402
    REPO_ROOT,
    die,
    infer_status,
    load_flat,
    load_notes_overrides,
    load_status_overrides,
    module_name,
    placeholders,
    MODULE_FILES,
)


def key_module(key: str) -> str:
    if key.startswith("admin."):
        parts = key.split(".")
        if len(parts) >= 2:
            return f"admin.{parts[1]}"
        return "admin"
    top = key.split(".", 1)[0]
    # Map top-level namespaces from spread files
    if top in {
        "home",
        "setup",
        "batchImageGuide",
        "auth",
        "common",
        "nav",
        "dashboard",
        "keys",
        "usage",
        "payment",
        "onboarding",
        "batchImage",
        "errors",
        "profile",
        "redeem",
        "affiliate",
        "availableChannels",
        "userSubscriptions",
        "notFound",
        "keyUsage",
    }:
        if top in ("home", "setup", "batchImageGuide"):
            return "landing"
        if top in ("auth", "common", "nav"):
            return "common"
        if top == "batchImage":
            return "batchImage"
        if top in ("payment", "onboarding"):
            return "misc"
        return "dashboard" if top != "errors" else "misc"
    return top


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--module", default="", help="Filter by module prefix/name")
    parser.add_argument(
        "--out",
        default="",
        help="Output JSONL path (default stdout or docs/i18n/ledger/<module>.jsonl)",
    )
    parser.add_argument("--locales", default="en,zh,vi")
    parser.add_argument(
        "--all-modules",
        action="store_true",
        help="Write one JSONL file per detected module under docs/i18n/ledger.",
    )
    args = parser.parse_args()

    codes = [c.strip() for c in args.locales.split(",") if c.strip()]
    flats: dict[str, dict[str, str]] = {}
    for code in codes:
        try:
            flats[code] = load_flat(code)
        except FileNotFoundError:
            flats[code] = {}
        except Exception as e:
            die(f"load {code}: {e}")

    en = flats.get("en", {})
    zh = flats.get("zh", {})
    vi = flats.get("vi", {})
    overrides = load_status_overrides()
    notes = load_notes_overrides()

    rows = []
    for key in sorted(en.keys()):
        mod = key_module(key)
        if args.module and mod != args.module and not mod.startswith(args.module):
            continue
        en_v = en.get(key, "")
        zh_v = zh.get(key, "")
        vi_v = vi.get(key, en_v)
        row = {
            "key": key,
            "module": mod,
            "en": en_v,
            "zh": zh_v,
            "vi": vi_v,
            "status": infer_status(en_v, vi_v, overrides.get(key)),
            "placeholders": placeholders(en_v),
            "notes": notes.get(key, ""),
        }
        rows.append(row)

    if args.all_modules:
        grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
        for row in rows:
            grouped[str(row["module"])].append(row)
        out_dir = REPO_ROOT / "docs" / "i18n" / "ledger"
        for mod, module_rows in sorted(grouped.items()):
            path = out_dir / f"{mod.replace('.', '_')}.jsonl"
            text = "\n".join(json.dumps(row, ensure_ascii=False) for row in module_rows) + "\n"
            path.write_text(text, encoding="utf-8")
            print(f"wrote {len(module_rows)} rows → {path}")
        return

    out_path = args.out
    if not out_path and args.module:
        out_path = str(REPO_ROOT / "docs" / "i18n" / "ledger" / f"{args.module.replace('.', '_')}.jsonl")

    lines = [json.dumps(r, ensure_ascii=False) for r in rows]
    text = "\n".join(lines) + ("\n" if lines else "")
    if out_path:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_text(text, encoding="utf-8")
        print(f"wrote {len(rows)} rows → {out_path}")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
