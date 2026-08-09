---
name: phase-2-image-upload
description: Backend Phase 2 status — image upload, file validation, children CRUD, image serving
metadata:
  type: project
  phase: 2 — Image Upload & Processing
  status: complete
  last_updated: 2026-08-09
---

## Phase 2: Image Upload & Processing — ✅ Complete

### Completed

#### Children CRUD
- `GET /api/children` — list children for parent (not paginated — bounded list, max ~10)
- `POST /api/children` — create child (409 on duplicate name within parent)
- `PUT /api/children/{child_id}` — rename child (ownership verified)
- `DELETE /api/children/{child_id}` — delete child, 204 No Content

#### Image Serving
- `GET /api/images/{kind}/{filename}` — serve images with ownership verification
- Allowed kinds: originals, annotated, thumbnails, questions, sheets
- Submission-based kinds: extract submission_id from filename, verify ownership via FK chain
- Sheets: UUID filename, ownership verified at generation time (skip submission check)
- Requires `?phone=` on all image URLs (enforced by `Depends(get_parent)`)

#### Submissions Upload
- `POST /api/submissions` — multipart upload, 202 Accepted, background grading
- Image validation: magic byte check (JPEG/PNG), 20MB limit, subject enum
- Client-side compression handled by frontend; backend stores original
- File storage: `data/images/originals/{id}.jpg` (relative to `apps/backend/`)
- Ownership: child_id must belong to phone's parent (404 if not)

### Models
- `Parent` — phone-based identity (auto-created on first use)
- `Child` — belongs to Parent, default names "小朋友1"/"小朋友2"
- `Submission` — status enum (pending/processing/completed/failed), image paths, token_usage (JSON)

### Dependencies
- `get_db()` — async session with auto-commit/rollback
- `get_parent()` — resolves phone → Parent, auto-creates with default children

See [[phase-3-grading-engine]] for the grading pipeline.
