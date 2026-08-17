"""Signed image URL tests: valid / expired / tampered."""

import os
import time

import pytest
from PIL import Image

from app.routers import submissions as sub_router
from app.services.image_signing import sign


def _write_jpeg(kind: str, filename: str) -> None:
    path = os.path.join(sub_router.IMAGE_ROOT, kind, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img = Image.new("RGB", (10, 10), color=(255, 255, 255))
    img.save(path, "JPEG")


def _url(kind: str, filename: str, expires: int, token: str) -> str:
    return f"/api/images/{kind}/{filename}?token={token}&expires={expires}"


@pytest.mark.asyncio
async def test_serve_image_valid_signature(client):
    kind, filename = "originals", "100.jpg"
    _write_jpeg(kind, filename)
    expires = int(time.time()) + 3600
    token = sign(kind, filename, expires)

    resp = await client.get(_url(kind, filename, expires, token))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_serve_image_expired_signature(client):
    kind, filename = "originals", "101.jpg"
    _write_jpeg(kind, filename)
    expires = int(time.time()) - 1  # already expired
    token = sign(kind, filename, expires)

    resp = await client.get(_url(kind, filename, expires, token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_serve_image_tampered_filename(client):
    kind, filename = "originals", "102.jpg"
    _write_jpeg(kind, filename)
    expires = int(time.time()) + 3600
    token = sign(kind, filename, expires)

    # Same token requested for a different file → signature mismatch.
    resp = await client.get(_url(kind, "103.jpg", expires, token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_serve_image_tampered_token(client):
    kind, filename = "originals", "104.jpg"
    _write_jpeg(kind, filename)
    expires = int(time.time()) + 3600
    token = sign(kind, filename, expires)
    tampered = ("a" if not token.endswith("a") else "b") + token[1:]

    resp = await client.get(_url(kind, filename, expires, tampered))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_serve_image_tampered_expiry(client):
    kind, filename = "originals", "105.jpg"
    _write_jpeg(kind, filename)
    expires = int(time.time()) + 3600
    token = sign(kind, filename, expires)

    # Extending expiry without recomputing the token → signature mismatch.
    resp = await client.get(_url(kind, filename, expires + 1000, token))
    assert resp.status_code == 403
