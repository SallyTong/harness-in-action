---
name: phase-4-polish
description: Backend Phase 5 status — error handling, rate limiting, cost logging, input validation hardening
metadata:
  type: project
  phase: 5 — Polish
  status: complete
  last_updated: 2026-08-09
---

## Phase 5: Polish — ✅ Complete

### Rate Limiting
- New `app/services/rate_limiter.py` — in-memory sliding-window rate limiter
- 60 requests/minute per phone identity (query param or `X-Parent-Phone` header)
- Health endpoint exempt
- Returns 429 with `Retry-After` header
- No external dependencies (pure Python)

### Cost Logging
- New `app/services/cost_logger.py` — per-call token cost tracking
- Pricing table for GLM-4V: flash (free), plus (10 CNY/1M), 4v (50 CNY/1M)
- `log_token_usage()` called after every successful GLM-4V API call
- Logs: submission_id, subject, model, status, prompt/completion/total tokens, cost in CNY
- Integrated into `grading.py` process_submission flow

### Error Handling Hardening
- **422 format override**: `RequestValidationError` handler in `main.py` converts FastAPI's default array-of-errors to contract's `{"detail": "<string>"}` format
- **Global handler logging**: 500 handler now calls `logger.exception()` — was silently swallowing errors
- **compose_sheet try/except**: `error_collections.py` wraps `compose_sheet()` call with try/except → 500 on Pillow/IO failures instead of crash

### Input Validation
- **X-Parent-Phone header**: `get_parent()` dependency now supports `X-Parent-Phone` header as alternative to `?phone=` query param (per contract `parentPhoneHeader` security scheme)
- **Phone optional in query**: phone query param made optional (default=None), manual validation provides clear error message when both are missing
- **Pydantic field_validator**: `GenerateSheetRequest` now validates `subject` (enum), `question_types` (enum), and `from_date`/`to_date` (YYYY-MM-DD format) at Pydantic level
- **submission_count**: `GET /api/children` now batch-queries actual submission counts per child (was hardcoded to 0)

### Tests
- All 21 existing tests pass
- Ruff check: clean (0 issues)
- Ruff format: clean (0 files reformatted)

### Known Limitations
- Rate limiter is in-memory only — resets on restart, not suitable for multi-process deployment
- Cost logging is informational only — no budget enforcement or aggregation endpoint
- Manual date validation in routers still exists alongside Pydantic validators (redundant but safe)

### Contract Deviations
None.

### Cross-Agent Requests
None.
