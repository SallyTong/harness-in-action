"""Simple in-memory rate limiter for the AI Homework Grader MVP.

Uses a sliding-window approach per identity. Identity is the hashed Bearer
token when present (authenticated requests), falling back to the client IP for
unauthenticated requests (e.g. auth endpoints). No external dependencies — pure
Python with FastAPI middleware integration.

Exemptions:
  - /api/health — no auth needed
  - /api/images/* — signed-URL file serving, inherently bursty (one page load = N thumbnails)
"""

import hashlib
import logging
import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limits — conservative for MVP with free-tier API budget
DEFAULT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 120  # reads + mutations combined

# Store: {identity: [timestamp, ...]}
_hits: dict[str, list[float]] = defaultdict(list)

# Paths exempt from rate limiting
EXEMPT_PATHS = (
    "/api/health",
    "/api/images/",  # signed-URL file serving — bursty by nature (thumbnails, annotated)
)


def _extract_identity(request: Request) -> str:
    """Return a rate-limit identity: hashed Bearer token, else client IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and len(auth) > 7:
        token = auth[7:]
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
        return f"token:{digest}"
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{client_ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit requests by identity (Bearer token or client IP).

    Exempts health check and signed-URL image serving.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Health check and image serving are exempt
        if path == "/api/health" or path.startswith("/api/images/"):
            return await call_next(request)

        identity = _extract_identity(request)

        now = time.time()
        cutoff = now - DEFAULT_WINDOW_SECONDS

        # Clean stale entries for this identity
        window_hits = [t for t in _hits[identity] if t > cutoff]
        _hits[identity] = window_hits

        if len(window_hits) >= MAX_REQUESTS_PER_WINDOW:
            logger.warning("Rate limit hit for identity=%s", identity)
            retry_after = int(window_hits[0] + DEFAULT_WINDOW_SECONDS - now) + 1
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        _hits[identity].append(now)

        response = await call_next(request)
        return response
