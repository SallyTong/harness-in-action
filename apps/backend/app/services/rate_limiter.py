"""Simple in-memory rate limiter for the AI Homework Grader MVP.

Uses a sliding-window approach per client (phone number). No external
dependencies — pure Python with FastAPI middleware integration.

Exemptions:
  - /api/health — no auth needed
  - /api/images/* — static file serving from disk, no external API cost,
    inherently bursty (one page load = N thumbnails)
"""

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

# Store: {phone: [timestamp, ...]}
_hits: dict[str, list[float]] = defaultdict(list)

# Paths exempt from rate limiting
EXEMPT_PATHS = (
    "/api/health",
    "/api/images/",  # static file serving — bursty by nature (thumbnails, annotated)
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit requests by phone identity.

    Exempts health check and image serving (static files from disk).
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Health check and image serving are exempt
        if path == "/api/health" or path.startswith("/api/images/"):
            return await call_next(request)

        # Extract identity: phone query param or X-Parent-Phone header
        phone = request.query_params.get("phone") or request.headers.get(
            "X-Parent-Phone"
        )

        if not phone:
            # No identity — let the endpoint's dependency handle the error
            return await call_next(request)

        now = time.time()
        cutoff = now - DEFAULT_WINDOW_SECONDS

        # Clean stale entries for this phone
        window_hits = [t for t in _hits[phone] if t > cutoff]
        _hits[phone] = window_hits

        if len(window_hits) >= MAX_REQUESTS_PER_WINDOW:
            logger.warning("Rate limit hit for phone=%s", phone[:4] + "*****")
            retry_after = int(window_hits[0] + DEFAULT_WINDOW_SECONDS - now) + 1
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        _hits[phone].append(now)

        response = await call_next(request)
        return response
