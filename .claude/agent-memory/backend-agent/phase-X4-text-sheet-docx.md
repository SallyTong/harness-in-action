---
name: phase-X4-text-sheet-docx
description: Backend X4 status — text sheet assembly + .docx export (sheet_text.py / sheet_docx.py) + generate format switch
metadata:
  type: project
  phase: X4 — Text Sheet + Word
  status: complete
  last_updated: 2026-08-21
---

# Phase X4 — Text Sheet + Word Export (文字试卷 + Word 导出)

**Status:** ✅ Complete (2026-08-21). The `generate` endpoint's `format` param + `GeneratedSheet` / `SheetQuestion` schemas were already in `contracts/openapi.yaml` v0.2.0 — no contract change. The signed docx download endpoint `GET /api/sheets/{filename}` is a new surface **not** declared in the contract (see Contract Deviations).

## What was built

- `app/services/sheet_text.py` — `SheetQuestionData` dataclass + `assemble_sheet_questions()`. Resolves the subject-specific transcribed text via `primary_text` (English `question_text` / Math `question_latex`); `is_incomplete` flags blank text so callers fall back to the cropped screenshot. Pure mapping — no I/O, no signing.
- `app/services/sheet_docx.py` — `build_sheet_docx()` (python-docx) + `render_latex_png()` (matplotlib mathtext, lazy import). Title bar (child + subject + date) + per-question body + bordered answer box. Math `question_latex` → PNG embedded; blank text → cropped screenshot fallback; **no answer key** (`solution_note` omitted by construction).
- `app/services/image_signing.py` — `build_signed_docx_url()` (kind `sheets`, same HMAC token + expiry scheme as images).
- `app/routers/error_collections.py` — generate endpoint branches on `format` (default `image`, backward-compatible). `format=text` random-samples via `func.random()` and returns `{format, question_count, questions[], docx_url}`. New `GET /api/sheets/{filename}` serves `.docx` via signed URL (`SAFE_FILENAME` + `".."` guard; 403/404, no bare path).
- `app/schemas/error_collections.py` — `format` field + validator (`text`|`image`); `SheetQuestionResponse`; `GenerateSheetResponse` extended with nullable `image_url` / `questions` / `docx_url`.
- `requirements.txt` — pinned `python-docx==1.2.0` and `matplotlib==3.10.9`.

## Tests

`tests/test_sheet_generation.py` (15 tests): assembly (math latex / english text / incomplete flag), `render_latex_png`, docx build (LaTeX PNG embedded, no answer key, incomplete→screenshot), generate endpoint (text structure, insufficient-count returns actual, default-image backward-compat, invalid format 422, no-match 400), docx download route (valid 200, tampered/expired 403, traversal 404, missing 404). `tests/conftest.py` redirects `ec_router.SHEET_DOCX_DIR` to the temp dir. 66 backend tests green; `ruff check` clean.

## Notes / accepted debt

- Mathtext renders a subset of LaTeX; unsupported markup (e.g. `\text{…}` with CJK, align/cases environments) raises and the code falls back to the screenshot.
- `.docx` files live in `data/images/sheets/{uuid}.docx` (same dir as image sheets); signing reuses kind `sheets`.
- Random selection uses SQL `func.random()` (compiles to MySQL `rand()` / SQLite `random()`); deterministic count ≤ `min(available, count)`.

## Cross-Agent Requests

X4 frontend work (AC-X4.4 Web + AC-X4.7 小程序) is in frontend-agent / miniapp-agent territory. They consume the surfaces above:

- **Web** (frontend-agent): generate-page 「试卷格式」分段控件默认「文字」; render math `question_latex` with KaTeX; `docx_url` → download button.
- **Mini-program** (miniapp-agent): `/pages/error-generate` 格式切换; math questions show `question_image_path` (signed screenshot) as primary — no LaTeX render in miniapp; `docx_url` → `wx.downloadFile` + `wx.openDocument({ fileType: "docx" })`.

Consumption contract (also in [[cross-cutting]]):
- `format=text` → `{format, question_count, questions[], docx_url}`; `questions[]` items carry `question_number/question_type/subject/source_submission_id` + nullable `question_text/question_latex/question_image_path`.
- `docx_url` and `question_image_path` are **signed URLs** (1h TTL) — render/download verbatim, never hand-assemble.

## Contract deviations

- `GET /api/sheets/{filename}` (signed docx download) is **not** specified in `contracts/openapi.yaml` v0.2.0. It mirrors `GET /api/images/{kind}/{filename}` (HMAC token + expiry, kind `sheets`). `GeneratedSheet.docx_url` references a download URL but no serving path is declared. Human should decide whether to add the endpoint to the contract.

## Known limitations

None carried forward — X3's `question_text` / `question_latex` are consumed as-is; no new DB schema ([[phase-X3-question-text]]).
