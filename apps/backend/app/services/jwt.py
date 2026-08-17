"""JWT creation and verification for Bearer authentication.

HS256 tokens with `sub` = parent id and `exp` = 30 days. The secret is read
from `JWT_SECRET` at call time (not import time) so tests and environment
swaps take effect without a module reload.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import jwt

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
TOKEN_TTL_DAYS = 30


class TokenError(Exception):
    """Raised when a token is missing, invalid, or expired."""


def _get_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        raise TokenError("JWT_SECRET is not configured")
    return secret


def create_access_token(parent_id: int) -> tuple[str, datetime]:
    """Sign a JWT for the given parent id. Returns (token, expires_at)."""
    expires_at = datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)
    payload = {"sub": str(parent_id), "exp": expires_at}
    token = jwt.encode(payload, _get_secret(), algorithm=JWT_ALGORITHM)
    return token, expires_at


def decode_access_token(token: str) -> int:
    """Verify a JWT and return its `sub` (parent id) as an int.

    Raises TokenError on any failure: bad signature, expired token, malformed
    payload, or missing/non-integer subject.
    """
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid or expired token") from exc

    sub = payload.get("sub")
    try:
        return int(sub)
    except (TypeError, ValueError) as exc:
        raise TokenError("Token is missing a valid subject") from exc
