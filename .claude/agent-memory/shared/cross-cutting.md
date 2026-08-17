---
name: cross-cutting
description: Cross-agent facts — rules that apply to both backend and frontend agents
metadata:
  type: project
  last_updated: 2026-08-17
---

## Image URLs Are Signed, Not Phone-Parameterized

Image files are served at `GET /api/images/{kind}/{filename}` **without** an
Authorization header, because `<img>`/`<image>` tags cannot send headers.
Instead, the backend returns a **signed URL** — `?token=<hmac>&expires=<unix_ts>`
(default TTL 1 hour) — and the frontend renders it directly.

**Why:** X1 removed phone-based identity (`?phone=` / `X-Parent-Phone`) in favor
of JWT Bearer auth. Images need a separate auth channel: an HMAC-SHA256 token
bound to `kind/filename:expires`. Ownership is enforced at *generation* time —
signed URLs are only produced for images that already passed the parent's
ownership check; the serve endpoint verifies signature + expiry + the
`submission_id` embedded in the filename.

**How to apply:**
- Backend: build image URLs via `app/services/image_signing.py`
  `build_signed_url(base_url, rel_path)`. It normalizes Windows backslashes and
  appends `?token=…&expires=…`. Secret is `IMAGE_SIGNING_SECRET` (env).
- Frontend (Web + mini-program): never hand-assemble image URLs. Render the
  `image_url` / `thumbnail_url` / `question_image_path` returned by the API
  verbatim.

**Files affected:**
- `apps/backend/app/services/image_signing.py` — `sign` / `verify` / `build_signed_url`
- `apps/backend/app/routers/*.py` — return `build_signed_url(...)`, no `?phone=`
- `apps/frontend/src/lib/api.ts`, `apps/miniapp/src/lib/api.ts` — pass through signed URLs
