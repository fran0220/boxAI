#!/usr/bin/env python3
"""Fail if leaf key sets differ across locales (default: en,zh,vi)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from locale_lib import die, load_flat  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--locales",
        default="en,zh,vi",
        help="Comma-separated locale codes (first is reference)",
    )
    parser.add_argument(
        "--allow-missing-locale",
        action="store_true",
        help="Skip locales whose index.ts is absent",
    )
    args = parser.parse_args()
    codes = [c.strip() for c in args.locales.split(",") if c.strip()]
    if not codes:
        die("no locales")

    flats: dict[str, set[str]] = {}
    for code in codes:
        try:
            flats[code] = set(load_flat(code))
        except FileNotFoundError:
            if args.allow_missing_locale:
                print(f"skip missing locale: {code}")
                continue
            die(f"locale not found: {code}")
        except Exception as e:
            die(f"failed to load {code}: {e}")

    if not flats:
        die("no locales loaded")

    ref = codes[0]
    if ref not in flats:
        die(f"reference locale {ref} not loaded")
    ref_keys = flats[ref]
    ok = True
    for code, keys in flats.items():
        only_ref = sorted(ref_keys - keys)
        only_code = sorted(keys - ref_keys)
        print(f"{code}: {len(keys)} keys")
        if only_ref:
            ok = False
            print(f"  missing vs {ref} ({len(only_ref)}):")
            for k in only_ref[:40]:
                print(f"    - {k}")
            if len(only_ref) > 40:
                print(f"    ... +{len(only_ref) - 40} more")
        if only_code:
            ok = False
            print(f"  extra vs {ref} ({len(only_code)}):")
            for k in only_code[:40]:
                print(f"    + {k}")
            if len(only_code) > 40:
                print(f"    ... +{len(only_code) - 40} more")

    if not ok:
        die("parity check FAILED")
    print("parity check OK")


if __name__ == "__main__":
    main()
