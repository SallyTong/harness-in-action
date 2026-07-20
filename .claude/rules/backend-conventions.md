---
paths:
  - "apps/backend/**"
---

# Backend Code Conventions

## Python / FastAPI

- Python 3.12+ required. Use `str | None` not `Optional[str]`, `list[int]` not `List[int]`.
- All endpoints return Pydantic response models. Never return raw dicts.
- Use `Depends()` for dependency injection (DB sessions, config). Do not instantiate dependencies manually.
- Endpoint functions are `async def`. Use `await` for all I/O operations.
- Route definitions use `APIRouter`, grouped by domain (e.g., `routers/submissions.py`, `routers/error_collections.py`).

## Error Handling

- Raise `HTTPException` with specific status codes. Never return 200 with an error body.
- All 4xx/5xx responses must include a `detail` field.
- Never expose stack traces or internal paths in error responses.

## Import Ordering

1. Standard library
2. Third-party packages
3. Local application imports (absolute paths from `app.*`)

Never use relative imports.

## Database / SQLAlchemy

- Models use SQLAlchemy 2.0 declarative style with `mapped_column()`.
- All queries use the async session pattern.
- Alembic migrations are auto-generated but always reviewed. Migration file names must be descriptive.

## Image Processing

- Use Pillow for all image operations.
- Store originals in `data/images/originals/`, annotated results in `data/images/annotated/`.
- File naming: `{submission_id}_{timestamp}.jpg`.
- Supported input formats: JPEG, PNG, HEIC (convert HEIC to JPEG on upload).

## GLM-4V Integration

- All API calls to Zhipu go through a dedicated service in `app/services/glm_client.py`.
- Log token usage per call. Record model version used.
- Use `GLM-4V-Flash` by default. Make model selection configurable via env var.
