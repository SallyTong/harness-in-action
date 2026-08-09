#!/usr/bin/env python3
"""Check that agent memory files are consistent with phase definitions.

Reads .claude/agents/backend-agent.md to count defined phases,
then checks .claude/agent-memory/backend-agent/ for matching memory files.
Exits 0 if consistent, 1 if mismatched.
"""

import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

AGENT_FILE = PROJECT_ROOT / ".claude" / "agents" / "backend-agent.md"
MEMORY_DIR = PROJECT_ROOT / ".claude" / "agent-memory" / "backend-agent"

# Phase pattern: "### Phase N: Name" or "### Phase N: Name ✅"
PHASE_RE = re.compile(r"^### Phase (\d+):", re.MULTILINE)
# Memory file pattern: "phase-N-slug.md" or "phase-N-slug.md"
MEMORY_RE = re.compile(r"^phase-(\d+)-.+")


def count_phases(filepath: Path) -> set[int]:
    """Extract phase numbers from backend-agent.md."""
    content = filepath.read_text(encoding="utf-8")
    return {int(m) for m in PHASE_RE.findall(content)}


def count_memory_files(directory: Path) -> set[int]:
    """Extract phase numbers from memory file names."""
    if not directory.exists():
        return set()
    return {
        int(m.group(1))
        for f in directory.iterdir()
        if f.suffix == ".md" and f.name != "MEMORY.md"
        and (m := MEMORY_RE.match(f.name))
    }


def main() -> int:
    if not AGENT_FILE.exists():
        print(f"WARNING: {AGENT_FILE} not found — skipping memory check")
        return 0

    if not MEMORY_DIR.exists():
        print(f"WARNING: {MEMORY_DIR} not found — skipping memory check")
        return 0

    phases = count_phases(AGENT_FILE)
    memories = count_memory_files(MEMORY_DIR)

    if not phases:
        return 0  # No phases defined yet

    missing = phases - memories
    extra = memories - phases

    if missing:
        print(
            f"MEMORY GAP: Phase(s) {sorted(missing)} defined in "
            f"backend-agent.md but no matching memory file in "
            f".claude/agent-memory/backend-agent/"
        )
        print(f"   Create: phase-{sorted(missing)[0]}-<slug>.md")

    if extra:
        print(
            f"STALE MEMORY: Memory file(s) for phase {sorted(extra)} "
            f"exist but no matching phase in backend-agent.md"
        )

    if missing or extra:
        return 1

    print(f"OK Agent memory consistent: {len(phases)} phases, {len(memories)} memory files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
