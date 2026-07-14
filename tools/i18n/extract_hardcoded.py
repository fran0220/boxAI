#!/usr/bin/env python3
"""Heuristic scan for CJK user-visible strings in Vue SFCs (template section)."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
# Rough template string literals containing CJK
STR_RE = re.compile(
    r"(?:>)([^<>]*[\u4e00-\u9fff][^<>]*)(?:<)"
    r"|(?:['\"`])([^'\"`]*[\u4e00-\u9fff][^'\"`]*)(?:['\"`])"
)


def extract_template(text: str) -> str:
    m = re.search(r"<template[^>]*>(.*)</template>", text, re.S | re.I)
    return m.group(1) if m else text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default="frontend/src")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    root = Path(args.path)
    count = 0
    for path in sorted(root.rglob("*.vue")):
        text = path.read_text(encoding="utf-8", errors="replace")
        tmpl = extract_template(text)
        if not CJK_RE.search(tmpl):
            continue
        hits = []
        for m in STR_RE.finditer(tmpl):
            s = (m.group(1) or m.group(2) or "").strip()
            if s and CJK_RE.search(s) and "t(" not in s:
                hits.append(re.sub(r"\s+", " ", s)[:120])
        if not hits:
            # still flag file
            hits = ["(CJK in template — inspect manually)"]
        print(f"{path}:")
        for h in hits[:15]:
            print(f"  - {h}")
        count += 1
        if count >= args.limit:
            print(f"... limit {args.limit} files")
            break
    print(f"files with CJK in template: {count}+")


if __name__ == "__main__":
    main()
