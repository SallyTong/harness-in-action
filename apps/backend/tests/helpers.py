"""Shared test helpers: auth token generation, parent creation, login."""

import time

from sqlalchemy import select

from app.models.parent import Parent
from app.services import sms
from app.services.jwt import create_access_token


def make_token(parent_id: int) -> str:
    token, _ = create_access_token(parent_id)
    return token


def auth_headers(parent_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(parent_id)}"}


async def create_parent(db_session, phone: str = "13800138000") -> int:
    """Create (or reuse) a bare Parent row and return its id."""
    result = await db_session.execute(select(Parent).where(Parent.phone == phone))
    parent = result.scalar_one_or_none()
    if parent is None:
        parent = Parent(phone=phone)
        db_session.add(parent)
        await db_session.flush()
    return parent.id


async def login(client, phone: str, code: str = "123456") -> str:
    """Log in a phone via the endpoint (auto-creates parent + default children).

    Seeds the in-memory SMS store with a known code so no transport mock is
    needed. Returns the JWT.
    """
    sms._codes[phone] = {
        "code": code,
        "expires_at": time.time() + 300,
        "sent_at": time.time() - 61,
    }
    resp = await client.post("/api/auth/login", json={"phone": phone, "code": code})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]
