#!/usr/bin/env python3
"""Lint BoxAI migration naming and protect applied upstream migrations.

Rules:
1. Any migration filename containing 'boxai' (case-insensitive) must match
   ^9\\d{2}_boxai_[a-z0-9_]+(\\.sql|_notx\\.sql)$
2. When CHECK_MIGRATION_BASE is set (git ref), forbid modifications/deletes
   of existing backend/migrations/* files that are not new 9xx_boxai files.
3. No new migration may use a numeric prefix < 900 unless it comes from an
   upstream merge (detected as: file already present on CHECK_MIGRATION_BASE).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIG_DIR = ROOT / "backend" / "migrations"

BOXAI_NAME = re.compile(r"^9\d{2}_boxai_[a-z0-9_]+(?:_notx)?\.sql$")
PREFIX = re.compile(r"^(\d+)")


def list_sql_files() -> list[Path]:
    if not MIG_DIR.is_dir():
        raise SystemExit(f"missing migrations dir: {MIG_DIR}")
    return sorted(p for p in MIG_DIR.iterdir() if p.suffix == ".sql" or p.name.endswith(".sql"))


def check_boxai_names(files: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in files:
        name = path.name
        if "boxai" in name.lower():
            if not BOXAI_NAME.match(name):
                errors.append(
                    f"{name}: BoxAI migrations must match "
                    "9xx_boxai_<slug>.sql or 9xx_boxai_<slug>_notx.sql"
                )
    return errors


def git_ls_tree(ref: str) -> set[str]:
    proc = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", ref, "backend/migrations"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SystemExit(f"git ls-tree failed for {ref}: {proc.stderr.strip()}")
    return {line.strip() for line in proc.stdout.splitlines() if line.strip()}


def git_diff_names(ref: str) -> tuple[set[str], set[str], set[str]]:
    """Return (added, modified, deleted) paths under backend/migrations."""
    proc = subprocess.run(
        ["git", "diff", "--name-status", f"{ref}...HEAD", "--", "backend/migrations"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    # Fallback for shallow or same-ref: compare working tree to ref
    if proc.returncode != 0 or not proc.stdout.strip():
        proc = subprocess.run(
            ["git", "diff", "--name-status", ref, "--", "backend/migrations"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    if proc.returncode != 0:
        raise SystemExit(f"git diff failed for {ref}: {proc.stderr.strip()}")

    added: set[str] = set()
    modified: set[str] = set()
    deleted: set[str] = set()
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("A") and len(parts) >= 2:
            added.add(parts[1])
        elif status.startswith("M") and len(parts) >= 2:
            modified.add(parts[1])
        elif status.startswith("D") and len(parts) >= 2:
            deleted.add(parts[1])
        elif status.startswith("R") and len(parts) >= 3:
            deleted.add(parts[1])
            added.add(parts[2])
    return added, modified, deleted


def check_against_base(base: str) -> list[str]:
    errors: list[str] = []
    added, modified, deleted = git_diff_names(base)

    for path in sorted(modified | deleted):
        name = Path(path).name
        if "boxai" in name.lower() and BOXAI_NAME.match(name):
            # product migrations may be amended before release only with care;
            # still forbid delete of applied product migrations in CI once on main.
            if path in deleted:
                errors.append(f"{path}: deleting BoxAI migration is forbidden")
            continue
        errors.append(
            f"{path}: modifying/deleting existing migration is forbidden "
            f"(base={base})"
        )

    for path in sorted(added):
        name = Path(path).name
        if "boxai" in name.lower():
            if not BOXAI_NAME.match(name):
                errors.append(f"{path}: invalid BoxAI migration name")
            continue
        m = PREFIX.match(name)
        if m and int(m.group(1)) >= 900:
            errors.append(
                f"{path}: numeric prefix >=900 reserved for 9xx_boxai_* names"
            )
        # New non-boxai migrations are only valid if they already exist on base
        # (i.e. came from upstream). Pure additions of <900 files on a feature
        # branch are rejected — they must arrive via upstream sync.
        # Exception: if base already has them, they won't appear in added.
        if m and int(m.group(1)) < 900:
            errors.append(
                f"{path}: new upstream-style migration must come from upstream "
                "sync, not a product PR (use 9xx_boxai_*.sql for BoxAI)"
            )

    return errors


def main() -> int:
    files = list_sql_files()
    errors = check_boxai_names(files)

    base = os.environ.get("CHECK_MIGRATION_BASE", "").strip()
    if base:
        errors.extend(check_against_base(base))
    else:
        print("migration-lint: CHECK_MIGRATION_BASE unset; name rules only")

    if errors:
        print("migration-lint FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"migration-lint: OK ({len(files)} sql files scanned)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
