#!/usr/bin/env python3
"""
PreToolUse hook: Block file writes containing hardcoded secrets.

Reads the tool call JSON from stdin, inspects Write/Edit content for:
- API keys (sk-*, GLM_API_KEY patterns, zhipu keys)
- Database passwords in connection strings
- JWT secrets, tokens, signing keys
- Generic password assignments as string literals

Exit 0: no secrets detected (allow)
Exit 1: secrets detected (block)
Exit 2: not a Write/Edit tool call (pass through)

Usage: Configure in .claude/settings.json as a PreToolUse hook:
{
  "matcher": "Write|Edit",
  "hooks": [{
    "type": "command",
    "command": "python .claude/hooks/secrets-blocker.py"
  }]
}
"""

import json
import re
import sys


# Patterns that indicate hardcoded secrets
SECRET_PATTERNS = [
    # API key patterns
    (re.compile(r'sk-[a-zA-Z0-9]{20,}', re.IGNORECASE), "OpenAI-style API key (sk-...)"),
    (re.compile(r'glm_api_key\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "GLM API key assignment"),
    (re.compile(r'api_key\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "Generic API key assignment"),
    (re.compile(r'api[_-]?key["\']?\s*[:=]\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "API key in dict/JSON"),

    # Database credentials
    (re.compile(r'mysql://[^:@]+:[^@]+@', re.IGNORECASE), "MySQL connection string with credentials"),
    (re.compile(r'postgresql://[^:@]+:[^@]+@', re.IGNORECASE), "PostgreSQL connection string with credentials"),
    (re.compile(r'mysql_password\s*=\s*["\'][^"\'$]{3,}["\']', re.IGNORECASE), "MySQL password assignment"),
    (re.compile(r'db_password\s*=\s*["\'][^"\'$]{3,}["\']', re.IGNORECASE), "Database password assignment"),

    # JWT / token secrets
    (re.compile(r'secret_key\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "Secret key assignment"),
    (re.compile(r'jwt_secret\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "JWT secret assignment"),
    (re.compile(r'signing_key\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "Signing key assignment"),

    # Generic passwords
    (re.compile(r'password\s*=\s*["\'][^"\'$]{3,}["\']', re.IGNORECASE), "Password assignment"),
    (re.compile(r'passwd\s*=\s*["\'][^"\'$]{3,}["\']', re.IGNORECASE), "Password assignment"),
    (re.compile(r'access_token\s*=\s*["\'][^"\'$]{10,}["\']', re.IGNORECASE), "Access token assignment"),

    # Zhipu-specific
    (re.compile(r'zhipu.*?(?:key|token|secret).*?["\'][^"\'$]{10,}["\']', re.IGNORECASE), "Zhipu API credential"),
]

# Patterns that are safe — allow-listed overrides
SAFE_PATTERNS = [
    # Environment variable references: os.environ["KEY"], os.getenv("KEY"), ${VAR}
    re.compile(r'os\.environ\[["\']'),
    re.compile(r'os\.getenv\(["\']'),
    re.compile(r'\$\{[A-Z_]+}'),
    re.compile(r'\$[A-Z_]+'),
    # Placeholder values
    re.compile(r'(?:password|passwd|secret)\s*=\s*["\'](?:your-|changeme|replace|xxx|test|placeholder|example)'),
    re.compile(r'api_key\s*=\s*["\'](?:your-|changeme|replace|xxx|test)'),
    # Comments (lines starting with # or //)
    re.compile(r'^\s*#.*$'),
    re.compile(r'^\s*//.*$'),
    # Empty strings
    re.compile(r'=\s*["\']["\']'),
]


def is_safe_line(line: str) -> bool:
    """Check if a line containing a potential secret is actually safe."""
    for pattern in SAFE_PATTERNS:
        if pattern.search(line):
            return True
    return False


def extract_content(tool_input: dict) -> str | None:
    """Extract the content being written from a tool call."""
    # Write tool: content is in 'content' field
    if 'content' in tool_input:
        return tool_input['content']
    # Edit tool: content is in 'new_string' field
    if 'new_string' in tool_input:
        return tool_input['new_string']
    return None


def scan_content(content: str) -> list[tuple[str, str, str]]:
    """Scan content for secrets. Returns list of (pattern_description, line_number, line)."""
    findings = []
    lines = content.split('\n')
    for i, line in enumerate(lines, start=1):
        # Skip empty lines and pure comment lines
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('<!--'):
            continue

        for pattern, description in SECRET_PATTERNS:
            if pattern.search(line):
                if not is_safe_line(line):
                    findings.append((description, i, stripped[:120]))
    return findings


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)

        data = json.loads(raw)

        # Extract tool name and input
        # Claude Code hook input format: {"tool_name": "...", "tool_input": {...}}
        tool_name = data.get('tool_name', data.get('tool', ''))
        tool_input = data.get('tool_input', data.get('input', {}))

        # Only check Write and Edit tools
        if tool_name not in ('Write', 'Edit'):
            sys.exit(0)

        content = extract_content(tool_input)
        if content is None:
            sys.exit(0)

        findings = scan_content(content)

        if findings:
            print("=" * 60, file=sys.stderr)
            print("🚫 SECURITY BLOCK: Hardcoded secrets detected", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            for desc, line_no, line_text in findings:
                print(f"  Line {line_no}: [{desc}]", file=sys.stderr)
                print(f"    {line_text}", file=sys.stderr)
            print("", file=sys.stderr)
            print("Use environment variables instead:", file=sys.stderr)
            print("  os.environ.get('KEY_NAME')       # Python", file=sys.stderr)
            print("  process.env.KEY_NAME              # JavaScript/TypeScript", file=sys.stderr)
            print("  ${KEY_NAME}                       # Docker / shell", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            sys.exit(1)

        sys.exit(0)

    except json.JSONDecodeError as e:
        # Cannot parse input — pass through rather than block legitimate writes
        print(f"secrets-blocker: cannot parse input, passing through: {e}", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"secrets-blocker: unexpected error, passing through: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
