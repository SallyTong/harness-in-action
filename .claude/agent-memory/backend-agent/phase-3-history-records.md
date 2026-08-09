---
name: phase-3-history-records
description: Backend Phase 3 status — history list, manual correction, error collections, practice sheet generation
metadata:
  type: project
  phase: 3 — History + Manual Correction
  status: complete
  last_updated: 2026-08-09
---

## Phase 3: History Records + Manual Correction — ✅ Complete

### New Endpoints

#### `GET /api/submissions` — List
- Paginated (limit/offset), filterable by child_id and subject
- Returns `{items: SubmissionSummary[], total: int}`
- Ownership: filtered by parent_id via Child JOIN
- Child names loaded in batch (single query)

#### `PATCH /api/submissions/{id}/questions/{qid}` — Manual Correction
- Body: `{is_correct: bool}`
- Ownership: Submission → Child → Parent chain (404 on mismatch)
- Only on completed submissions (400 otherwise)
- All in one transaction: update is_correct + is_manually_fixed, recalculate correct_count, sync ErrorQuestion
- ErrorQuestion sync: correct→wrong adds/updates; wrong→correct deletes

#### `GET /api/error-collections` — List
- New router: `app/routers/error_collections.py`
- Filters: child_id, subject, question_type, from_date, to_date
- Per-request date validation (YYYY-MM-DD), to_date inclusive (adds 1 day)
- Ownership: JOIN Child with parent_id filter
- Image URLs include phone param ([[image-url-phone-param]])

#### `POST /api/error-collections/generate` — Practice Sheet
- Body: child_id, subject, question_types[], from_date, to_date, count (1-50)
- Ownership: child_id must belong to parent (404 if not)
- `compose_sheet()` in `app/services/annotation.py`:
  - Vertical composite of error question images (1200px wide)
  - Title bar: child name, subject, date
  - Each question: label + cropped image + solution note + answer space
  - Output: `data/images/sheets/{uuid}.jpg`

### Schemas Added
- `schemas/submissions.py`: `SubmissionListResponse`, `FixQuestionRequest`, `FixQuestionResponse`
- `schemas/error_collections.py`: `ErrorQuestionResponse`, `ErrorCollectionListResponse`, `GenerateSheetRequest`, `GenerateSheetResponse`

### Bugs Fixed
- [[image-url-phone-param]] — image URLs must include `?phone=` or 422
- `sheets` kind added to `serve_image` allowed_kinds
- Windows path separator (`\`) normalized to `/` in `_build_image_url`

### Contract Deviations
None.

### Cross-Agent Requests
None.
