from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend root (apps/backend/.env), not from CWD
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import children, error_collections, health, submissions, wechat
from app.services.rate_limiter import RateLimitMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Homework Grader", version="0.1.0")

# Rate limiting must be added before CORS and routers
app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(wechat.router)
app.include_router(children.router)
app.include_router(submissions.router)
app.include_router(error_collections.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Override FastAPI's default 422 to match the OpenAPI Error schema.

    The contract requires {"detail": "<string>"}, not the default
    {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}.
    We convert the first error's location and message into a single string.
    """
    errors = exc.errors()
    if errors:
        first = errors[0]
        loc = " → ".join(str(part) for part in first.get("loc", []))
        msg = first.get("msg", "Validation error")
        detail = f"Validation error: {loc} — {msg}"
    else:
        detail = "Validation error"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return 500 without exposing stack traces."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
