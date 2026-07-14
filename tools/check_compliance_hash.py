#!/usr/bin/env python3
"""Verify byte-stable compliance artifacts against pinned SHA-256 hashes.

Pin file format (same as sha256sum):
  <hex>  <relative-path>

Exit 0 on match; non-zero if any file is missing, extra, or hash-mismatched.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN_FILE = ROOT / "tools" / "compliance-hash.pins"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_pins(path: Path) -> dict[str, str]:
    pins: dict[str, str] = {}
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 2:
            raise SystemExit(f"{path}:{line_no}: expected '<hash>  <path>', got: {raw!r}")
        digest, rel = parts
        if len(digest) != 64:
            raise SystemExit(f"{path}:{line_no}: invalid sha256 length")
        pins[rel] = digest.lower()
    if not pins:
        raise SystemExit(f"{path}: no pins defined")
    return pins


def main() -> int:
    if not PIN_FILE.is_file():
        print(f"ERROR: missing pin file {PIN_FILE}", file=sys.stderr)
        return 2

    pins = load_pins(PIN_FILE)
    failed = False

    for rel, expected in sorted(pins.items()):
        path = ROOT / rel
        if not path.is_file():
            print(f"MISSING  {rel}")
            failed = True
            continue
        actual = sha256_file(path)
        if actual != expected:
            print(f"MISMATCH {rel}")
            print(f"  expected {expected}")
            print(f"  actual   {actual}")
            failed = True
        else:
            print(f"OK       {rel}")

    if failed:
        print(
            "\nCompliance freeze failed. If the change is intentional, update "
            "tools/compliance-hash.pins after legal review (see docs/BRAND.md).",
            file=sys.stderr,
        )
        return 1

    print("compliance-hash: all pins matched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
