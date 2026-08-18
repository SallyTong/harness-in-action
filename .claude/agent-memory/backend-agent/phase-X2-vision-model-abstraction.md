---
name: phase-X2-vision-model-abstraction
description: Backend X2 status — VisionModel provider abstraction (GLM/Qwen), factory, multi-provider cost log
metadata:
  type: project
  phase: X2 — Vision Model Abstraction
  status: complete
  last_updated: 2026-08-17
---

# Phase X2 — Vision Model Abstraction (GLM / Qwen)

**Status:** ✅ Complete (2026-08-17). No contract change (`contracts/openapi.yaml` v0.2.0 unchanged).

## What was built

- `app/services/vision/base.py` — `VisionModel` Protocol (`async grade(image: bytes, subject) -> GradingResult`), plus `GradedQuestionData` / `GradingResult` / `TokenUsage` dataclasses and shared `parse_questions` / `question_from_dict`. `GradedQuestionData.question_text` / `question_latex` are X3 placeholders (None for now).
- `app/services/vision/prompts.py` — shared `SYSTEM_PROMPT_TEMPLATE` + `SUBJECT_TYPES` + `build_prompt` (identical across providers → schema alignment).
- `app/services/vision/http.py` — shared `post_json_with_retry(url, payload, headers, *, label, error_cls)` — one retry on transient errors.
- `app/services/vision/glm.py` — `GLMVisionModel`, refactored from the deleted `glm_client.py` (same prompt/payload/retry/token extraction).
- `app/services/vision/qwen.py` — `QwenVisionModel` → `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`, `Authorization: Bearer <QWEN_API_KEY>`.
- `app/services/vision/factory.py` — `get_vision_model()` reads `VISION_PROVIDER` (glm|qwen, default glm) + `VISION_MODEL` (default `glm-4v-flash`/`qwen-vl-max`); legacy `GLM_MODEL` still honored for glm. Loads `.env` (background-task CWD safety).
- `app/services/grading.py` — now calls `get_vision_model().grade(image_bytes, subject)` and stores `token_usage` as `{provider, model, prompt/completion/total_tokens}`; `questions_data = [asdict(q) for q in result.questions]`.
- `app/services/cost_logger.py` — `log_token_usage(provider, model, …)`; added qwen-vl pricing (qwen-vl-plus 1.5/4.5, qwen-vl-max 3/9 CNY per 1M tokens).

## Removed

- `app/services/glm_client.py` (logic moved into `vision/glm.py`; only consumer was `grading.py`).

## New env vars

`VISION_PROVIDER` (glm|qwen), `VISION_MODEL` (model id), `QWEN_API_KEY` (DashScope). `GLM_API_KEY`/`GLM_MODEL` retained.

## Tests

`tests/test_vision_model.py` — 14 tests: both providers mocked at HTTP layer (schema + payload + prompt alignment), factory selection/fallback/model resolution, `TokenUsage.to_dict` + legacy-record passthrough, and an end-to-end `process_submission` run (glm vs qwen fake → identical annotation + error-sync). 49 backend tests green; `ruff check` + `ruff format` clean.

## Accepted debt / notes

1. `QWEN_API_KEY` not present in `.env` — read from env only; add locally to switch providers.
2. Qwen-VL pricing (cost log) is from DashScope's public billing page; re-verify if it changes.
3. `question_text` / `question_latex` placeholders activate in X3 (AD-23/AD-24); DB columns + pipeline wiring land there.

## Contract deviations

None — implemented against `contracts/openapi.yaml` v0.2.0 (no change).

See [[phase-X1-auth-jwt]] for the auth baseline this builds on.
