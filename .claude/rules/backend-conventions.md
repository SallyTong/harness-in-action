---
paths:
  - "apps/backend/**"
  - "infra/**"
  - "scripts/**"
---

# Backend Conventions

Rules that would cause real bugs if forgotten. Detailed architecture is in `docs/architecture.md`.

## Non-Negotiable

- Python 3.12+ syntax: `str | None`, `list[int]`, `match` statements. No `Optional[]`, `List[]`, `Dict[]`.
- All endpoints `async def`. Use `await` for all I/O.
- Return Pydantic response models. Never return raw dicts.
- Use `Depends()` for DI (DB session, config, parent resolution). Never instantiate dependencies manually in endpoint bodies.
- Routes grouped by domain in `app/routers/` with `APIRouter(prefix=..., tags=[...])`.
- Raise `HTTPException` for all error responses. Never return 200 with error body. Never expose stack traces.
- Resolve `parent_id` from the JWT `sub` claim in a shared `Depends()` (`get_current_parent_id`). **Never accept `parent_id` as a direct request parameter.**
- Cross-resource ownership checks (child_id/submission_id/question_id → trace FK to Parent): return **404** (not 403) on mismatch.
- Zero hardcoded secrets. GLM_API_KEY, DB passwords from env vars only.
- GLM-4V calls via dedicated service `app/services/glm_client.py`. Log token usage per call. Model from `GLM_MODEL` env var.
- Image storage paths per architecture §8: stored relative to `apps/backend/` as `data/images/originals/{id}.jpg`, `data/images/annotated/{id}.jpg`, `data/images/thumbnails/{id}.jpg`, `data/images/questions/{id}_{num}.jpg`, `data/images/sheets/{uuid}.jpg`. Store relative paths in DB.
- Annotation: green `#22C55E` (✓), red `#EF4444` (?). Use bundled Noto Sans SC font.
- Grading flow: `POST /api/submissions` → 202 Accepted → BackgroundTasks → GLM-4V → annotate → sync ErrorQuestion → status=completed|failed. Frontend polls every 2s.
- ErrorQuestion sync MUST happen in the same transaction as GradedQuestion changes. No eventual consistency.
- Alembic forward-only in MVP. Auto-generate (`--autogenerate`), always review manually.
