---
name: phase-3-grading-engine
description: Backend Phase 3 status — GLM-4V prompt engineering, annotation overlay, structured grading results
metadata:
  type: project
  phase: 3 — Grading Engine
  status: complete
  last_updated: 2026-08-09
---

## Phase 3: Grading Engine — ✅ Complete

### Completed

#### GLM-4V Client (`app/services/glm_client.py`)
- Prompt engineering per subject (English: choice/fill_blank/reading/composition, Math: choice/fill_blank/calculation/word_problem)
- Chinese system prompt with structured JSON output instructions
- Percentage-coordinate bounding boxes (x/y/w/h, 0-100)
- Two-attempt retry with httpx (TimeoutException, HTTPError)
- Markdown code-fence stripping from model responses
- Token usage extraction from API response
- `max_tokens`: 1024 for flash, 4096 for paid models
- Custom `GLMError` exception class

#### Annotation (`app/services/annotation.py`)
- Green checkmark (✓, `#22C55E`) for correct answers
- Red question mark (?, `#EF4444`) for wrong answers
- Solution notes in Chinese with white background box for readability
- Font fallback chain: bundled NotoSansSC → Windows system fonts → Linux system fonts → PIL default
- Question region cropping via percentage coordinates
- Thumbnail generation (256px max edge)

#### Grading Pipeline (`app/services/grading.py`)
- Background task: `process_submission(submission_id)`
- Flow: pending → processing → GLM-4V → store GradedQuestions → annotate → crop questions → thumbnail → sync ErrorQuestion → completed|failed
- Failed grading: rollback, mark status=failed in fresh session, store error details
- ErrorQuestion sync: UPSERT per (submission_id, question_number), same transaction

### Key Design Decisions
- `_sanitize_question_number()` — truncates to 50 chars, takes first line
- `_sanitize_question_type()` — fuzzy-match model output to valid DB enum via substring
- `_sanitize_error_category()` — same pattern for error categories
- `_percent_to_pixels()` — converts GLM-4V percentage coords to pixel coords

### Models Added
- `GradedQuestion` — question_number, question_position (JSON), question_type (enum), is_correct, solution_note, error_category (enum), is_manually_fixed
- `ErrorQuestion` — aggregates wrong answers across submissions, error_count, error_timestamps (JSON)

See [[phase-4-history-records]] for the history/manual-correction/error-collections layer.
