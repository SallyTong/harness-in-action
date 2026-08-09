---
name: phase-2-photo-upload
description: Frontend Phase 2 status — camera capture, client-side compression, upload flow, processing page
metadata:
  type: project
  phase: 2 — Photo Upload Flow
  status: complete
  last_updated: 2026-08-09
---

## Phase 2: Photo Upload Flow — ✅ Complete

### Completed

#### HomePage (`/`)
- Child selector dropdown, subject toggle (英语/数学)
- Camera capture via `<input capture="environment">`
- Gallery picker via ActionSheet
- Client-side compression: max 2048px longest edge, JPEG Q80%
- HEIC detection with user guidance
- Image preview with remove button
- Upload via `POST /api/submissions` → navigate to processing page

#### ProcessingPage (`/submissions/:id/processing`)
- Polling every 2s via `GET /api/submissions/{id}`
- Status carousel: "识别题目中…" / "批改答案中…" / "生成解题思路中…"
- 30s timeout with retry option
- Auto-navigate to result page on completion

#### Components Built
- `ui/Toast`, `ui/ActionSheet`, `ui/ConfirmDialog`
- `layout/BottomNav` — 3-tab navigation (批改/历史/错题集)
- `hooks/usePhone` — localStorage phone persistence

See [[phase-3-result-display]] for the result page and annotation display.
