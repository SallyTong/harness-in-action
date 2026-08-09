"""Simple in-memory rate limiter for the AI Homework Grader MVP.

Uses a sliding-window approach per client (phone number). No external
dependencies — pure Python with FastAPI middleware integration.
"""

import logging
import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Default limits — conservative for MVP with free-tier API budget
DEFAULT_WINDOW_SECONDS = 60
DEFAULT_MAX_REQUESTS = 60  # per window

# Store: {phone: [timestamp, ...]}
_hits: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate-limit requests by phone identity.

    Only applies to endpoints that require a phone parameter. Health
    check is exempt.
    """

    async def dispatch(self, request: Request, call_next):
        # Health check is exempt
        if request.url.path == "/api/health":
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

        if len(window_hits) >= DEFAULT_MAX_REQUESTS:
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
