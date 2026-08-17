"""HMAC-signed image URLs.

Image files are served at GET /api/images/{kind}/{filename} without an
Authorization header (because <img>/<image> tags cannot send headers). Access
is instead authorized by an HMAC-SHA256 token + expiry in the query string.
The token is bound to the specific kind+filename+expiry, so it cannot be reused
for another file or extended. Ownership is enforced at generation time: signed
URLs are only ever produced for images that already passed the parent's
ownership check.
"""

import base64
import hashlib
import hmac
import os
import time
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

DEFAULT_TTL_SECONDS = 3600  # 1 hour

IMAGE_KINDS = frozenset({"originals", "annotated", "thumbnails", "questions", "sheets"})


def _secret() -> str:
    secret = os.getenv("IMAGE_SIGNING_SECRET", "")
    if not secret:
        raise RuntimeError("IMAGE_SIGNING_SECRET is not configured")
    return secret


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign(kind: str, filename: str, expires: int) -> str:
    """Compute the HMAC token for a (kind, filename, expires) triple."""
    message = f"{kind}/{filename}:{expires}".encode()
    digest = hmac.new(_secret().encode("utf-8"), message, hashlib.sha256).digest()
    return _b64url(digest)


def verify(kind: str, filename: str, token: str, expires: int) -> bool:
    """Return True if the signature is valid and not expired."""
    if time.time() > expires:
        return False
    expected = sign(kind, filename, expires)
    return hmac.compare_digest(expected, token)


def build_signed_url(
    base_url: str,
    rel_path: str | None,
    ttl: int = DEFAULT_TTL_SECONDS,
) -> str | None:
    """Build a signed image URL from a relative storage path.

    `rel_path` is a DB-stored path like "data/images/originals/123.jpg".
    Returns None for empty/None input. Normalizes Windows backslashes.
    """
    if not rel_path:
        return None
    normalized = rel_path.replace("\\", "/")
    if normalized.startswith("data/images/"):
        kind_and_file = normalized[len("data/images/") :]
    else:
        kind_and_file = normalized.replace("data/images/", "", 1)
    parts = kind_and_file.split("/", 1)
    if len(parts) != 2:
        return None
    kind, filename = parts
    expires = int(time.time()) + ttl
    token = sign(kind, filename, expires)
    base = base_url.rstrip("/")
    return f"{base}/api/images/{kind}/{filename}?token={token}&expires={expires}"
