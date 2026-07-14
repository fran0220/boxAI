#!/usr/bin/env python3
"""Shared helpers for loading and flattening vue-i18n locale TS modules."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCALES_ROOT = REPO_ROOT / "frontend" / "src" / "i18n" / "locales"
FRONTEND_ROOT = REPO_ROOT / "frontend"

PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")

MODULE_FILES = [
    "landing.ts",
    "common.ts",
    "dashboard.ts",
    "misc.ts",
    "batchImage.ts",
    "admin/overview.ts",
    "admin/channels.ts",
    "admin/accounts.ts",
    "admin/resources.ts",
    "admin/ops.ts",
    "admin/settings.ts",
]


def module_name(rel: str) -> str:
    name = rel.replace(".ts", "").replace("/", ".")
    return name


def flatten(obj: Any, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    if not isinstance(obj, dict):
        return out
    for k, v in obj.items():
        full = f"{prefix}.{k}" if prefix else str(k)
        if isinstance(v, dict):
            out.update(flatten(v, full))
        elif isinstance(v, list):
            out[full] = json.dumps(v, ensure_ascii=False)
        else:
            out[full] = "" if v is None else str(v)
    return out


def placeholders(text: str) -> list[str]:
    return sorted(set(PLACEHOLDER_RE.findall(text or "")))


def load_locale_bundle(locale: str) -> dict[str, Any]:
    """Bundle locales/{locale}/index.ts via esbuild and evaluate as ESM."""
    entry = LOCALES_ROOT / locale / "index.ts"
    if not entry.exists():
        raise FileNotFoundError(entry)

    esbuild = FRONTEND_ROOT / "node_modules" / "esbuild" / "bin" / "esbuild"
    if not esbuild.exists():
        # pnpm layout (and worktree symlink to main node_modules)
        candidates = sorted(
            (FRONTEND_ROOT / "node_modules").glob("**/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild")
        ) or sorted((FRONTEND_ROOT / "node_modules").glob("**/esbuild/bin/esbuild"))
        if not candidates:
            raise RuntimeError(
                "esbuild not found under frontend/node_modules; run pnpm install in frontend/"
            )
        esbuild = candidates[0]

    result = subprocess.run(
        [
            str(esbuild),
            str(entry),
            "--bundle",
            "--format=esm",
            "--platform=neutral",
            "--outfile=/dev/stdout",
            "--log-level=error",
        ],
        capture_output=True,
        text=True,
        cwd=str(FRONTEND_ROOT),
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"esbuild failed for {locale}: {result.stderr}")

    # Write temp ESM and import via node
    tmp = REPO_ROOT / "tools" / "i18n" / f".bundle_{locale}.mjs"
    tmp.write_text(result.stdout, encoding="utf-8")
    node = subprocess.run(
        [
            "node",
            "-e",
            f"import m from 'file://{tmp}'; console.log(JSON.stringify(m.default))",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        tmp.unlink(missing_ok=True)
    except OSError:
        pass
    if node.returncode != 0:
        raise RuntimeError(f"node eval failed for {locale}: {node.stderr}")
    return json.loads(node.stdout)


def load_flat(locale: str) -> dict[str, str]:
    return flatten(load_locale_bundle(locale))


def set_nested(root: dict[str, Any], dotted: str, value: str) -> None:
    parts = dotted.split(".")
    cur: dict[str, Any] = root
    for p in parts[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[p] = nxt
        cur = nxt
    cur[parts[-1]] = value


def infer_status(en: str, vi: str, override: str | None = None) -> str:
    if override:
        return override
    if not vi or vi == en:
        return "missing"
    return "draft"


def load_status_overrides() -> dict[str, str]:
    path = REPO_ROOT / "docs" / "i18n" / "ledger" / "status.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        return {str(k): str(v) for k, v in data.items()}
    return {}


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    sys.exit(code)
