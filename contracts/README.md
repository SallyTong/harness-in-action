# API Contract Governance

`openapi.yaml` is the **authoritative specification** for every API endpoint, request body, response schema, and error format. Both backend and frontend implement against it. **Neither agent modifies it unilaterally.**

## Rules

1. **`openapi.yaml` is the single source of truth.** Backend and frontend subagents read it and implement exactly what it defines — no extra fields, no missing fields, no renamed properties.
2. **No unilateral changes.** Neither [backend-agent](../.claude/agents/backend-agent.md) nor [frontend-agent](../.claude/agents/frontend-agent.md) may modify files under `contracts/`.
3. **Contract deviations go through the human.** If a subagent discovers the spec is underspecified or needs a change, it records the need in its agent memory under "Contract Deviations." The human reviews and decides whether to update the contract.
4. **After a contract update, both subagents must re-read it** and adjust their implementations to match.

## Versioning (MVP)

- **Additive changes** (new optional fields, new endpoints, expanded enums): bump the patch version in `info.version`.
- **Breaking changes** (renamed/removed fields, changed required fields): bump the minor version. All agents must update their implementations.

## Usage

```bash
# Lint the spec for errors
npx @redocly/cli lint contracts/openapi.yaml

# Preview interactive docs
npx @redocly/cli preview-docs contracts/openapi.yaml

# Generate TypeScript types for frontend (optional, MVP may hand-write)
npx openapi-typescript contracts/openapi.yaml -o apps/frontend/src/types/api.d.ts
```

## Adding or Changing Endpoints

1. Propose the change by documenting it in your agent memory under "Contract Deviations."
2. The human reviews and approves the change.
3. The human (or a designated agent with explicit approval) updates `openapi.yaml`.
4. Both backend and frontend agents re-read the updated spec and adjust their implementations.
5. Run integration verification to confirm alignment.
