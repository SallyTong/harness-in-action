---
name: cross-cutting
description: Cross-agent facts — rules that apply to both backend and frontend agents
metadata:
  type: project
  last_updated: 2026-08-09
---

## Image URLs Must Include Phone Param

Every `_build_image_url()` helper across all routers MUST accept and use a `phone` parameter to append `?phone=` to generated image URLs. The `GET /api/images/{kind}/{filename}` endpoint requires `phone` via `Depends(get_parent)`, which resolves it from the query string. Without it, images return 422.

**Why:** The `serve_image` endpoint uses `Depends(get_parent)` which expects `phone` as a required query parameter (regex `^\d{11}$`). This is intentional — it enforces ownership verification on every image request.

**How to apply:** When adding a new `_build_image_url` helper or calling an existing one, always pass the parent's phone AND normalize Windows backslash paths (`rel_path.replace("\\", "/")`). The reference implementation is in `apps/backend/app/routers/error_collections.py` (lines 30-40).

**Files affected:**
- `apps/backend/app/routers/error_collections.py` — correct implementation (phone + path normalization)
- `apps/backend/app/routers/submissions.py` — passes phone but missing path normalization (may produce broken URLs on Windows if DB stores backslash paths)
- Any new router that builds image URLs

**Smoke test regression:** `scripts/integration-smoke-test.sh` §5d checks all error question image URLs have `phone=` and generated sheet images are fetchable.
