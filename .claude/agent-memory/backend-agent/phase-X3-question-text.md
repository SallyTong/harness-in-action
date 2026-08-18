---
name: phase-X3-question-text
description: Backend X3 status — question text (question_text/question_latex) emitted by vision model, persisted + redundant
metadata:
  type: project
  phase: X3 — Question Text
  status: complete
  last_updated: 2026-08-18
---

# Phase X3 — Question Text (错题题干文字)

**Status:** ✅ Complete (2026-08-18). No contract change — `contracts/openapi.yaml` v0.2.0 already carried the nullable `question_text`/`question_latex` fields on `GradedQuestion`/`ErrorQuestion`.

## What was built

- Migration `c3d4e5f6a7b8` (forward-only) — `graded_questions` + `error_questions` each gain `question_text TEXT NULL` + `question_latex TEXT NULL`. Nullable by design: hand-written / graphic questions may not transcribe.
- `app/models/graded_question.py` / `app/models/error_question.py` — matching `Mapped[str | None]` columns.
- `app/services/vision/prompts.py` — grading prompt now asks the model for `question_text` (English, plain text) and `question_latex` (Math, LaTeX); instructed to return null rather than invent for pure-graphic content.
- `app/services/vision/base.py` — `question_from_dict` now parses `question_text`/`question_latex` (was an X2 placeholder); `GradedQuestionData` docstring updated to reflect activation.
- `app/services/vision/question_text.py` — the AD-24 seam: `QuestionText` dataclass, `QuestionTextExtractor` Protocol, `VisionModelExtractor` (surfaces the text the vision model emitted during grading — no extra API call), and an `OCRExtractor` reserved as a comment (PaddleOCR / MinerU).
- `app/services/vision/__init__.py` — exports `QuestionText` / `QuestionTextExtractor` / `VisionModelExtractor`.
- `app/services/grading.py` — pipeline writes `question_text`/`question_latex` to `GradedQuestion` via `VisionModelExtractor`; `_sync_error_questions` redundantly copies both fields to `ErrorQuestion` on create + update (same transaction, per arch §8 consistency invariant).
- `app/routers/submissions.py` + `app/schemas/submissions.py` — `GradedQuestionResponse` exposes the fields; `fix_question_grade` Correct→Wrong path also syncs them.
- `app/routers/error_collections.py` + `app/schemas/error_collections.py` — `ErrorQuestionResponse` exposes the fields.

## Tests

`tests/test_vision_model.py` — added `test_question_from_dict_parses_question_text` + `test_vision_model_extractor_returns_question_text`; end-to-end pipeline test now asserts `question_text`/`question_latex` land identically in `GradedQuestion` + `ErrorQuestion` (added `ORDER BY GradedQuestion.id` to fix a non-deterministic result order). `tests/test_submissions.py` asserts the submission-detail API returns `question_text`. 51 backend tests green; `ruff check .` clean.

## Notes / accepted debt

- Subject↔field correspondence (English→`question_text`, Math→`question_latex`) is the model's responsibility; the pipeline persists both fields unconditionally — no subject-based filtering.
- X4 consumes these fields as its text-sheet ingredient (`sheet_text.py` / `sheet_docx.py`, AD-25/AD-26). See [[phase-X2-vision-model-abstraction]] for the abstraction this builds on.

## Contract deviations

None — implemented against `contracts/openapi.yaml` v0.2.0 (fields already present).
