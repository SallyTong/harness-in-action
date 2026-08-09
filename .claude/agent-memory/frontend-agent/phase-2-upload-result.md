---
name: phase-2-upload-result
description: Frontend Phase 2 status — photo upload flow, processing page, result display
metadata:
  type: project
  phase: 2 — Upload + Result
  status: complete
  last_updated: 2026-08-09
---

## Phase 2: Photo Upload + Result Display — ✅ Complete

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

#### ResultPage (`/submissions/:id/result`)
- Score overview card (mono font, green/red color)
- Annotated image with lightbox zoom
- Per-question detail list: question number, type badge, ✓/?, expandable solution note
- Error category labels (语法/词汇/拼写 etc.)
- Manual correction toggle (see [[phase-3-history-errors]])
- Loading: skeleton screen matching layout
- Error: message + retry + return home

#### Components Built
- `ui/Toast`, `ui/ActionSheet`, `ui/ConfirmDialog`, `ui/ImageLightbox`, `ui/Skeleton`
- `layout/BottomNav` — 3-tab navigation (批改/历史/错题集)
- `hooks/usePhone` — localStorage phone persistence

See [[phase-3-history-errors]] for history records, error book, and sheet generation.
