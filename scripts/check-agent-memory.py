#!/usr/bin/env python
"""Check that agent memory files are consistent with phase definitions.

Reads .claude/agents/*.md to count defined phases, then checks
.claude/agent-memory/<agent>/ for matching memory files.
Exits 0 if consistent, 1 if mismatched.
"""

import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

AGENTS_DIR = PROJECT_ROOT / ".claude" / "agents"
MEMORY_BASE = PROJECT_ROOT / ".claude" / "agent-memory"

# Phase pattern: "### Phase N: Name" — N may carry a letter prefix (e.g. W1, X1)
PHASE_RE = re.compile(r"^### Phase ([A-Za-z]*\d+):", re.MULTILINE)
# Memory file pattern: "phase-<token>-slug.md" (token = e.g. "1", "W1", "X1")
MEMORY_RE = re.compile(r"^phase-([A-Za-z]*\d+)-.+")


def count_phases(filepath: Path) -> set[str]:
    """Extract phase tokens from an agent definition file."""
    content = filepath.read_text(encoding="utf-8")
    return set(PHASE_RE.findall(content))


def count_memory_files(directory: Path) -> set[str]:
    """Extract phase tokens from memory file names."""
    if not directory.exists():
        return set()
    return {
        m.group(1)
        for f in directory.iterdir()
        if f.suffix == ".md" and f.name != "MEMORY.md"
        and (m := MEMORY_RE.match(f.name))
    }


def check_agent(agent_file: Path, memory_dir: Path) -> int:
    """Check one agent for phase-memory consistency. Returns 0 if ok, 1 if not."""
    agent_name = agent_file.stem.replace("-agent", "")

    if not agent_file.exists():
        print(f"WARNING: {agent_file} not found -- skipping")
        return 0

    if not memory_dir.exists():
        print(f"WARNING: {memory_dir} not found -- skipping")
        return 0

    phases = count_phases(agent_file)
    memories = count_memory_files(memory_dir)

    if not phases:
        return 0  # No phases defined yet

    missing = phases - memories
    extra = memories - phases

    if missing:
        print(
            f"MEMORY GAP [{agent_name}]: Phase(s) {sorted(missing)} defined in "
            f"{agent_file.relative_to(PROJECT_ROOT)} but no matching memory file"
        )

    if extra:
        print(
            f"STALE MEMORY [{agent_name}]: Memory file(s) for phase {sorted(extra)} "
            f"exist but no matching phase in {agent_file.relative_to(PROJECT_ROOT)}"
        )

    if missing or extra:
        return 1

    print(f"OK [{agent_name}]: {len(phases)} phases, {len(memories)} memory files")
    return 0


def main() -> int:
    exit_code = 0

    # Find all agent definition files
    agent_files = sorted(AGENTS_DIR.glob("*-agent.md"))
    if not agent_files:
        print("No agent files found -- nothing to check")
        return 0

    for agent_file in agent_files:
        agent_name = agent_file.stem  # e.g., "backend-agent"
        memory_dir = MEMORY_BASE / agent_name

        if check_agent(agent_file, memory_dir) != 0:
            exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
