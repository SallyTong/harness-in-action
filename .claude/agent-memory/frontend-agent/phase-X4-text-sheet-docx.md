# Phase X4 — Text Sheet + Word (Web)

**Status:** ✅ Complete (2026-08-21). No contract change — `contracts/openapi.yaml` v0.2.0 already carried the `format` param + `GeneratedSheet` (`questions[]` / `docx_url`). Backend X4 (`sheet_text.py` / `sheet_docx.py` / generate `format` switch) was already merged.

## What was built

- `packages/api-types/index.ts` — `GenerateSheetResponse` reshaped to the contract: `format: "text" | "image"`, `question_count`, nullable `image_url` / `questions` / `docx_url`; new `SheetQuestion` interface (`question_number`, `question_type`, `subject`, `question_text`/`question_latex`, `question_image_path`, `source_submission_id`).
- `src/pages/ErrorGeneratePage.tsx` — added:
  - 「试卷格式」 segmented control (文字试卷 default / 图片试卷), reusing the existing subject-control visual pattern. Default `format` state is `"text"`; generate body always sends `format` explicitly (`format=text` / `format=image`).
  - Text-sheet preview: header (「已生成 N 道错题试卷」 + 「下载 Word」 `<a href={docx_url}>`), then one card per question — 「第 N 题」+ type badge + subject, `<QuestionText>` stem (reuses the KaTeX `trust:false` convention), fallback to the cropped screenshot when no usable text, and a dashed 「作答区域」 divider.
  - Image branch unchanged (「保存图片」 + sheet `<img>`), now gated on `result.image_url`.
- `src/pages/ErrorGeneratePage.test.tsx` — 3 tests: defaults to text format, generates a text sheet (asserts `format:"text"` sent + stem rendered + Word link href), switches to image (asserts `format:"image"` sent + sheet image rendered).

## XSS safety

Math stems render through `QuestionText` (`trust: false`, `throwOnError: false`); English stems as React text nodes. No `dangerouslySetInnerHTML` with model output. The docx download is a plain `<a href={signed docx_url}>` — the backend serves it with `Content-Disposition: attachment`, so no hand-assembled URL.

## Tests / infra

- Added `afterEach(cleanup)` to `src/test/setup.ts`. Vitest runs without `globals`, so RTL auto-cleanup was not registering; previous tests only passed because their queries happened not to collide across accumulated DOM. New explicit cleanup makes the "4 tests minimum per page" convention safe.
- `npx tsc --noEmit` clean; 32 vitest green; `npm run build` succeeds (KaTeX chunk ~568KB / gzip 170KB — pre-existing from X3).

## Cross-agent / miniapp note

- Shared `GenerateSheetResponse.image_url` is now nullable. `apps/miniapp/src/pages/error-generate/index.tsx` got a one-line `result.image_url ?? ''` guard so miniapp `tsc` stays green. **Miniapp X4 is still outstanding** — the miniapp generate page still only handles the image path and has no format switch / text preview / docx `wx.openDocument` preview.

## Contract deviations

None.
