---
name: phase-2-core-grading
description: Backend Phase 2+3 status — image upload, GLM-4V grading, annotation pipeline, async processing
metadata:
  type: project
  phase: 2-3 — Core Grading
  status: complete
  last_updated: 2026-08-09
---

## Phase 2: Image Upload & Processing — ✅ Complete

### Completed
- `POST /api/submissions` — multipart upload, 202 Accepted, background grading
- Image validation: magic byte check (JPEG/PNG), 20MB limit, subject enum
- Client-side compression handled by frontend; backend stores original
- File storage: `data/images/originals/{id}.jpg`
- Ownership: child_id must belong to phone's parent (404 if not)

## Phase 3: Grading Engine — ✅ Complete

### Completed
- GLM-4V client: `app/services/glm_client.py` — prompt per subject, JSON response parsing, token tracking
- Annotation: `app/services/annotation.py` — green ✓ / red ?, solution notes in Chinese, question cropping
- Thumbnail generation: 256px max edge
- Grading pipeline: `app/services/grading.py` — status=processing → GLM-4V → store questions → annotate → thumbnail → sync ErrorQuestion → status=completed|failed
- ErrorQuestion sync: UPSERT pattern per (submission_id, question_number), same transaction as GradedQuestion insert
- Token usage logged per API call

### Key Design Decisions
- `_sanitize_question_number()` — truncates to 50 chars, takes first line
- `_sanitize_question_type()` — fuzzy-match model output to valid DB enum
- `_sanitize_error_category()` — same pattern for error categories

See [[phase-3-history-records]] for the history/manual-correction/error-collections layer.
