---
name: cross-cutting
description: Cross-agent facts — rules that apply to both backend and frontend agents
metadata:
  type: project
  last_updated: 2026-08-21
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

## Text-sheet `.docx` URLs Are Also Signed

X4 added `format` to `POST /api/error-collections/generate`:
- `format=text` → `{format, question_count, questions[], docx_url}` where each
  `SheetQuestion` has `question_number/question_type/subject/source_submission_id`
  plus nullable `question_text` (English) / `question_latex` (Math) /
  `question_image_path` (signed screenshot fallback).
- `format=image` (or omitted) → `{format, image_url, question_count}` (backward
  compatible).

`docx_url` is a **signed URL** — `GET /api/sheets/{filename}?token=…&expires=…`
(HMAC kind `sheets`, 1h TTL) — same scheme as image URLs. No `Authorization`
header needed; ownership was verified at generation time.

**Why:** `<image>`/`wx.downloadFile`/`wx.openDocument` cannot attach a Bearer
header, and the docx must never be exposed as a bare file path.

**How to apply:**
- Backend: build it with `build_signed_docx_url(base_url, rel_path)` (kind
  `sheets`); `question_image_path` uses `build_signed_url` as before.
- Web: render math `question_latex` with KaTeX; English `question_text` as text;
  `docx_url` → download button.
- Mini-program: **no LaTeX render** (AC-X4.7) — math questions show
  `question_image_path` (signed screenshot) as the primary body, text as
  auxiliary; incomplete questions (no usable text) carry only the screenshot.
  Download via `wx.downloadFile({ url: docx_url })` then
  `wx.openDocument({ filePath, fileType: "docx" })`.
- Never hand-assemble `docx_url` / `question_image_path` — render/download the
  returned URL verbatim (1h TTL, so generate then present promptly).

## Pre-release backlog

Accepted technical debt and release blockers across v1 + v2 are consolidated in
[release-backlog.md](release-backlog.md) — review before any public release.
