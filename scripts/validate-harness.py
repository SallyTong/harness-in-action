#!/usr/bin/env python
"""Validate harness configuration for consistency.

Checks that catch the issues we've repeatedly missed:
  1. Agent phases match memory files (delegates to check-agent-memory.py)
  2. Skill directories match their SKILL.md frontmatter names
  3. Hook commands reference valid paths and tools
  4. CLAUDE.md design doc references exist on disk
  5. Required directories have .gitkeep
  6. No deprecated Python patterns (datetime.utcnow)
  7. No stale wiki cross-references in memory files

Run before committing:  python scripts/validate-harness.py
"""

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CLAUDE_DIR = PROJECT_ROOT / ".claude"
DOCS_DIR = PROJECT_ROOT / "docs"
DATA_DIR = PROJECT_ROOT / "data"
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"

ERRORS = 0
WARNINGS = 0


def error(msg: str) -> None:
    global ERRORS
    ERRORS += 1
    print(f"  ERROR: {msg}")


def warn(msg: str) -> None:
    global WARNINGS
    WARNINGS += 1
    print(f"  WARN:  {msg}")


def ok(msg: str) -> None:
    print(f"  OK:    {msg}")


# ── 1. Agent phase-memory consistency ──────────────────

def check_agent_memory() -> None:
    """Run check-agent-memory.py and report."""
    print("\n--- 1. Agent Memory Consistency ---")
    import subprocess
    result = subprocess.run(
        [sys.executable, str(PROJECT_ROOT / "scripts" / "check-agent-memory.py")],
        capture_output=True, text=True
    )
    for line in result.stdout.strip().split("\n"):
        if line.startswith("OK"):
            ok(line)
        elif line:
            print(f"  {line}")
    if result.returncode != 0:
        error("Agent memory inconsistent — run check-agent-memory.py for details")


# ── 2. Skill name consistency ──────────────────────────

def check_skill_names() -> None:
    """Check that skill directory names match their SKILL.md frontmatter name."""
    print("\n--- 2. Skill Name Consistency ---")
    skills_dir = CLAUDE_DIR / "skills"
    if not skills_dir.exists():
        warn("No .claude/skills/ directory")
        return

    for skill_dir in sorted(skills_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            error(f"Skill dir '{skill_dir.name}' has no SKILL.md")
            continue

        content = skill_md.read_text(encoding="utf-8")
        m = re.search(r'^name:\s*"([^"]+)"', content, re.MULTILINE)
        if not m:
            error(f"Skill '{skill_dir.name}': no 'name:' in SKILL.md frontmatter")
            continue

        declared_name = m.group(1)
        if declared_name != skill_dir.name:
            error(
                f"Skill name mismatch: directory='{skill_dir.name}' "
                f"vs SKILL.md name='{declared_name}'"
            )
        else:
            ok(f"Skill '{skill_dir.name}' consistent")


# ── 3. Hook command validation ─────────────────────────

def check_hook_commands() -> None:
    """Check that hook commands reference valid paths (best-effort)."""
    print("\n--- 3. Hook Command Paths ---")
    settings_file = CLAUDE_DIR / "settings.json"
    if not settings_file.exists():
        warn("No .claude/settings.json")
        return

    settings = json.loads(settings_file.read_text(encoding="utf-8"))
    hooks = settings.get("hooks", {})

    for hook_phase in ["PreToolUse", "PostToolUse"]:
        for entry in hooks.get(hook_phase, []):
            for hook in entry.get("hooks", []):
                cmd = hook.get("command", "")

                # Check for fragile bare 'cd' without anchoring
                if re.search(r"(?<!\$\{CLAUDE_PROJECT_DIR\})\bcd\s+apps/", cmd):
                    warn(
                        f"Hook 'cd apps/...' not anchored with CLAUDE_PROJECT_DIR: "
                        f"{cmd[:80]}..."
                    )

    ok("Hook commands checked")


# ── 4. CLAUDE.md doc references exist ──────────────────

def check_claude_md_refs() -> None:
    """Check that doc files referenced in CLAUDE.md actually exist."""
    print("\n--- 4. CLAUDE.md Document References ---")
    claude_md = PROJECT_ROOT / "CLAUDE.md"
    if not claude_md.exists():
        warn("No CLAUDE.md")
        return

    content = claude_md.read_text(encoding="utf-8")
    # Find markdown links: [text](path)
    links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)

    for text, path in links:
        if path.startswith("http"):
            continue
        # Resolve relative to project root
        target = PROJECT_ROOT / path
        if not target.exists():
            # Some links may have an anchor
            target_no_anchor = PROJECT_ROOT / path.split("#")[0]
            if not target_no_anchor.exists():
                error(f"CLAUDE.md link broken: [{text}]({path})")

    ok("CLAUDE.md references checked")


# ── 5. Required directories have .gitkeep ──────────────

def check_gitkeep() -> None:
    """Check that image storage directories exist."""
    print("\n--- 5. Required Directories ---")
    required_dirs = [
        "data/images/originals",
        "data/images/annotated",
        "data/images/thumbnails",
        "data/images/questions",
        "data/images/sheets",
    ]
    for d in required_dirs:
        path = PROJECT_ROOT / d
        if path.exists():
            ok(f"Directory exists: {d}")
        else:
            error(f"Missing directory: {d} — create with .gitkeep")


# ── 6. Deprecated Python patterns ──────────────────────

def check_deprecated_patterns() -> None:
    """Check for deprecated Python patterns in backend code."""
    print("\n--- 6. Deprecated Python Patterns ---")
    patterns = [
        (r"datetime\.utcnow", "datetime.utcnow() is deprecated — use datetime.now(timezone.utc)"),
        (r"from typing import (?:Optional|List|Dict|Tuple)", "Use Python 3.12+ syntax (str | None, list[X])"),
    ]

    found = 0
    for py_file in BACKEND_DIR.rglob("*.py"):
        p = str(py_file)
        if ".venv" in p or "site-packages" in p or "tests" in p or "__pycache__" in p:
            continue
        try:
            content = py_file.read_text(encoding="utf-8")
        except Exception:
            continue
        for pattern, msg in patterns:
            if re.search(pattern, content):
                error(f"{py_file.relative_to(PROJECT_ROOT)}: {msg}")
                found += 1

    if found == 0:
        ok("No deprecated patterns found")


# ── 7. Stale wiki cross-references in memory ────────────

def check_memory_crossrefs() -> None:
    """Check that [[wiki-links]] in memory files point to existing files."""
    print("\n--- 7. Memory Cross-References ---")
    memory_base = CLAUDE_DIR / "agent-memory"
    if not memory_base.exists():
        return

    all_memories: set[str] = set()
    for agent_dir in memory_base.iterdir():
        if not agent_dir.is_dir():
            continue
        for mem_file in agent_dir.glob("*.md"):
            all_memories.add(mem_file.stem)

    # Check each memory file's [[references]]
    ref_pattern = re.compile(r"\[\[([^\]]+)\]\]")
    broken = 0
    for agent_dir in memory_base.iterdir():
        if not agent_dir.is_dir():
            continue
        for mem_file in agent_dir.glob("*.md"):
            content = mem_file.read_text(encoding="utf-8")
            for ref in ref_pattern.findall(content):
                # Skip cross-directory refs like ../shared/cross-cutting
                if "/" in ref:
                    ref_name = ref.split("/")[-1]
                else:
                    ref_name = ref
                if ref_name not in all_memories and ref_name != "shared/cross-cutting":
                    error(
                        f"{mem_file.relative_to(PROJECT_ROOT)}: "
                        f"broken link [[{ref}]] — file '{ref_name}.md' not found"
                    )
                    broken += 1

    if broken == 0:
        ok("All cross-references valid")


# ═══════════════════════════════════════════════════════

def main() -> int:
    print("=" * 50)
    print("  Harness Configuration Validator")
    print("=" * 50)

    check_agent_memory()
    check_skill_names()
    check_hook_commands()
    check_claude_md_refs()
    check_gitkeep()
    check_deprecated_patterns()
    check_memory_crossrefs()

    print(f"\n{'=' * 50}")
    print(f"  Errors: {ERRORS}  Warnings: {WARNINGS}")
    print(f"{'=' * 50}")

    if ERRORS > 0:
        print("HARNESS VALIDATION FAILED — fix errors before committing.")
        return 1
    else:
        print("Harness configuration is consistent.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
