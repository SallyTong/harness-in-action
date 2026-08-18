---
paths:
  - "**/tests/**"
  - "**/*.test.*"
  - "**/*.spec.*"
---

# Testing Conventions

Rules that would let bugs slip through if forgotten. Detailed patterns are in subagent definitions.

## Non-Negotiable

### Coverage Minimums
- **Every endpoint**: 1 happy path + 1 input validation error + 1 resource not found + 1 ownership/access check.
- **Every service function**: 1 happy path + 1 external dependency failure + 1 edge case.
- **Every page component**: render + loading state + error state + empty state (4 tests minimum).
- **Every interactive component**: render with props + user interaction + accessibility check.

### Backend (pytest)
- Use `httpx.AsyncClient` for endpoint tests (async, matches FastAPI).
- **Vision provider calls must be mocked** in all tests (both GLM and Qwen). Never call real API (cost + latency + flaky).
- Test database isolated per test (transaction rollback or fixture teardown).
- Naming: `test_<function>_<scenario>_<expected>`.
- Use `pytest-asyncio` for async tests. Shared fixtures in `tests/conftest.py`.

### Frontend (Vitest + React Testing Library)
- **msw** for API mocking — intercepts fetch at network level.
- Mock `URL.createObjectURL` and Canvas `toBlob` for image upload tests.
- Test at 375px viewport. Use `@testing-library/user-event` for interactions.
- Naming: `<ComponentName>.test.tsx`, `describe('<Component> > <scenario>')`, `it('<expected behavior>')`.

### CI Gate
Before merge: `pytest tests/ -v` (all pass), `ruff check app/` (clean), `npx tsc --noEmit` (clean), `npx vitest run` (all pass), `npm run build` (succeeds).

### Test Data
- Fixed, predictable data. No `random()` or `Date.now()` in assertions.
- Canonical test phone: `13800138000`. Small test image in `apps/backend/tests/fixtures/`.
