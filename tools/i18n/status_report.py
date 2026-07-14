#!/usr/bin/env python3
"""Summarize locale key counts and vi translation progress."""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from locale_lib import (  # noqa: E402
    REPO_ROOT,
    die,
    infer_status,
    load_flat,
    load_status_overrides,
)
from export_ledger import key_module  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", default="", help="Write markdown report path")
    args = parser.parse_args()

    flats: dict[str, dict[str, str]] = {}
    for code in ("en", "zh", "vi"):
        try:
            flats[code] = load_flat(code)
        except Exception as e:
            flats[code] = {}
            print(f"warn: {code}: {e}", file=sys.stderr)

    en, zh, vi = flats["en"], flats["zh"], flats["vi"]
    overrides = load_status_overrides()

    by_mod: dict[str, dict[str, int]] = defaultdict(lambda: {
        "en": 0, "zh": 0, "vi": 0, "draft_plus": 0, "approved": 0, "missing": 0
    })

    all_keys = set(en) | set(zh) | set(vi)
    for key in all_keys:
        mod = key_module(key)
        if key in en:
            by_mod[mod]["en"] += 1
        if key in zh:
            by_mod[mod]["zh"] += 1
        if key in vi:
            by_mod[mod]["vi"] += 1
        en_v = en.get(key, "")
        vi_v = vi.get(key, "")
        st = infer_status(en_v, vi_v, overrides.get(key))
        if st == "approved":
            by_mod[mod]["approved"] += 1
            by_mod[mod]["draft_plus"] += 1
        elif st in ("draft", "reviewed"):
            by_mod[mod]["draft_plus"] += 1
        else:
            by_mod[mod]["missing"] += 1

    lines = [
        "# i18n progress",
        "",
        f"Total en keys: **{len(en)}** · zh: **{len(zh)}** · vi: **{len(vi)}**",
        "",
        "| Module | en | zh | vi | vi≠en | approved | missing |",
        "|--------|----|----|----|-------|----------|---------|",
    ]
    for mod in sorted(by_mod):
        s = by_mod[mod]
        lines.append(
            f"| {mod} | {s['en']} | {s['zh']} | {s['vi']} | {s['draft_plus']} | {s['approved']} | {s['missing']} |"
        )

    only_en = sorted(set(en) - set(zh))
    only_zh = sorted(set(zh) - set(en))
    lines += [
        "",
        "## en/zh drift",
        "",
        f"- only en: {len(only_en)}",
        f"- only zh: {len(only_zh)}",
    ]
    if only_en[:20]:
        lines.append("- sample only en: " + ", ".join(only_en[:20]))
    if only_zh[:20]:
        lines.append("- sample only zh: " + ", ".join(only_zh[:20]))

    text = "\n".join(lines) + "\n"
    print(text)
    if args.write:
        Path(args.write).write_text(text, encoding="utf-8")
        print(f"wrote {args.write}", file=sys.stderr)


if __name__ == "__main__":
    main()
