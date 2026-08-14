#!/usr/bin/env python
"""Hook router: only run relevant checks based on which file changed.

Reads the PostToolUse JSON payload from stdin, extracts the file path,
and runs only the checks relevant to that file's territory.

Usage in settings.json hook:
  python ${CLAUDE_PROJECT_DIR}/scripts/hook-router.py
"""

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def run(cmd: str, timeout: int = 60) -> tuple[int, str]:
    """Run a shell command, return (exit_code, output)."""
    try:
        result = subprocess.run(
            ["bash", "-c", cmd],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(PROJECT_ROOT),
        )
        return result.returncode, (result.stdout + result.stderr).strip()
    except subprocess.TimeoutExpired:
        return 1, "(timed out)"
    except FileNotFoundError:
        # bash not available — fall back to sh
        try:
            result = subprocess.run(
                ["sh", "-c", cmd],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(PROJECT_ROOT),
            )
            return result.returncode, (result.stdout + result.stderr).strip()
        except Exception:
            return 1, "(shell not available)"


def get_file_path() -> str:
    """Extract file_path from the PostToolUse JSON payload on stdin."""
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return ""

    # The payload structure: {"tool_name": "Write", "tool_input": {"file_path": "..."}}
    tool_input = payload.get("tool_input", {})
    if isinstance(tool_input, dict):
        return tool_input.get("file_path", "") or ""
    return ""


def is_backend(path: str) -> bool:
    return "/apps/backend/" in path or "/infra/" in path or "/scripts/" in path


def is_frontend(path: str) -> bool:
    return "/apps/frontend/" in path


def is_miniapp(path: str) -> bool:
    return "/apps/miniapp/" in path


def is_harness(path: str) -> bool:
    p = Path(path)
    return ".claude/" in path or p.name in ("CLAUDE.md",)


def is_contract(path: str) -> bool:
    return "/contracts/" in path


def is_docs(path: str) -> bool:
    return "/docs/" in path


def main() -> int:
    file_path = get_file_path()
    rel = Path(file_path).name if file_path else "unknown"

    if not file_path:
        return 0  # Nothing to check

    backend = is_backend(file_path)
    frontend = is_frontend(file_path)
    miniapp = is_miniapp(file_path)
    harness = is_harness(file_path)

    ran = 0
    failed = 0

    # ── Backend changes ──────────────────────
    if backend:
        print(f"[hook-router] {rel} → backend checks")

        # ruff lint
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/backend && python -m ruff check app/ --quiet 2>&1"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

        # pytest
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/backend && python -m pytest tests/ -q 2>&1 | tail -10"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

    # ── Frontend changes ─────────────────────
    if frontend:
        print(f"[hook-router] {rel} → frontend checks")

        # tsc
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/frontend && npx tsc --noEmit 2>&1"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

        # vitest
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/frontend && npx vitest run --reporter=verbose 2>&1 | tail -20"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

    # ── Miniapp changes ─────────────────────
    if miniapp:
        print(f"[hook-router] {rel} → miniapp checks")

        # tsc
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/miniapp && npx tsc --noEmit 2>&1"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

        # test
        code, out = run(
            "cd ${CLAUDE_PROJECT_DIR}/apps/miniapp && npm test 2>&1 | tail -20"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

    # ── Harness / CLAUDE.md changes ──────────
    if harness:
        print(f"[hook-router] {rel} → harness checks")
        code, out = run(
            f"python {PROJECT_ROOT}/scripts/validate-harness.py 2>&1"
        )
        if out:
            print(out)
        ran += 1
        if code != 0:
            failed += 1

    # ── No territory matched — skip ──────────
    if ran == 0:
        print(f"[hook-router] {rel} → no checks needed (skipped)")
        return 0

    print(f"[hook-router] {rel} → {ran} checks, {failed} failed")
    return 0  # Never block on hook failure — just report


if __name__ == "__main__":
    sys.exit(main())
