---
name: phase-4-history-errors
description: Frontend Phase 4 status — history list, history detail, error book, practice sheet generation, manual correction
metadata:
  type: project
  phase: 4 — History + Error Collections
  status: complete
  last_updated: 2026-08-09
---

## Phase 4: History + Error Collections — ✅ Complete

### New Pages

#### HistoryPage (`/history`)
- Filter bar: child dropdown + subject dropdown
- Paginated list of `SubmissionSummary` cards:
  - 64x64 thumbnail (rounded-[10px]), child name, subject badge (indigo), score (mono), relative time
- Click → `navigate(/submissions/:id)`
- "加载更多" button for pagination (LIMIT=20)
- Empty state: "还没有批改记录。去批改一张试卷吧！" + CTA
- Loading: 5 skeleton cards

#### HistoryDetailPage (`/submissions/:id`)
- Tab switcher: "批改后" | "原图" — toggles image display
- Score overview card + image lightbox
- Per-question detail with manual correction toggle (see below)
- Skeleton loading, error, toast states

#### ErrorBookPage (`/errors`)
- Collapsible filter panel: child, subject, question type, time range
- Stats: "共 X 道错题"
- Error question cards: cropped image, question_number, type badge, child_name, subject, date
- Expandable solution note with error category badge
- Fixed bottom bar: "生成错题试卷" → navigates to `/errors/generate` with filter params
- Empty state (no errors): "🎉 还没有错题。继续保持！"
- Empty state (filtered): "没有符合条件的错题" + clear button
- Loading: 3 skeleton cards

#### ErrorGeneratePage (`/errors/generate`)
- Parameter form: child selector, subject toggle, question type multi-select (pills), count slider (1-50)
- "生成试卷" button → `POST /api/error-collections/generate`
- Result: composite sheet image preview + "保存图片" (download) + "重新生成"
- Generating state: spinner + "正在生成…"
- Error: Toast

### Manual Correction Toggle
- Integrated into both **ResultPage** and **HistoryDetailPage**
- Per-question toggle button: green ✓ (correct) / red ? (wrong)
- Optimistic update: flip immediately, revert on API failure
- Toast feedback on success/failure
- "已修正" amber badge when `is_manually_fixed`
- Score auto-recalculates after toggle

### API Client
- `apiPatch` added to `lib/api.ts`
- Types: `SubmissionSummary`, `ErrorQuestionItem`, `SubmissionListResponse`, `ErrorCollectionListResponse`, `FixQuestionResponse`, `GenerateSheetResponse`

### Tests
- `HistoryPage.test.tsx` — 10 tests: phone input, loading, error, empty, data display, filters, load more

See [[phase-2-photo-upload]] and [[phase-3-result-display]] for previous work.
