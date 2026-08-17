"""Auth endpoint tests: SMS send-code + JWT login + de-phone auth guards."""

import pytest

from app.services import sms

PHONE_A = "13800138000"


async def _noop_send(*args, **kwargs):
    return None


@pytest.mark.asyncio
async def test_send_code_ok(client, monkeypatch):
    monkeypatch.setattr(sms, "_send_sms_via_aliyun", _noop_send)
    resp = await client.post("/api/auth/send-code", json={"phone": PHONE_A})
    assert resp.status_code == 200
    assert resp.json()["retry_after"] == 60


@pytest.mark.asyncio
async def test_send_code_rate_limited_429(client, monkeypatch):
    monkeypatch.setattr(sms, "_send_sms_via_aliyun", _noop_send)
    first = await client.post("/api/auth/send-code", json={"phone": PHONE_A})
    assert first.status_code == 200

    second = await client.post("/api/auth/send-code", json={"phone": PHONE_A})
    assert second.status_code == 429
    assert "detail" in second.json()


@pytest.mark.asyncio
async def test_send_code_invalid_phone_422(client):
    resp = await client.post("/api/auth/send-code", json={"phone": "123"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_ok(client, monkeypatch):
    monkeypatch.setattr(sms, "_send_sms_via_aliyun", _noop_send)
    monkeypatch.setattr(sms, "_generate_code", lambda: "123456")
    await client.post("/api/auth/send-code", json={"phone": PHONE_A})

    resp = await client.post(
        "/api/auth/login", json={"phone": PHONE_A, "code": "123456"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_type"] == "Bearer"
    assert isinstance(data["user_id"], int)
    assert data["token"]
    assert data["expires_at"]


@pytest.mark.asyncio
async def test_login_wrong_code_401(client, monkeypatch):
    monkeypatch.setattr(sms, "_send_sms_via_aliyun", _noop_send)
    monkeypatch.setattr(sms, "_generate_code", lambda: "123456")
    await client.post("/api/auth/send-code", json={"phone": PHONE_A})

    resp = await client.post(
        "/api/auth/login", json={"phone": PHONE_A, "code": "000000"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_invalid_code_format_422(client):
    resp = await client.post("/api/auth/login", json={"phone": PHONE_A, "code": "12"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_first_registration_creates_parent_and_children(
    client, monkeypatch
):
    monkeypatch.setattr(sms, "_send_sms_via_aliyun", _noop_send)
    monkeypatch.setattr(sms, "_generate_code", lambda: "123456")
    await client.post("/api/auth/send-code", json={"phone": PHONE_A})

    resp = await client.post(
        "/api/auth/login", json={"phone": PHONE_A, "code": "123456"}
    )
    assert resp.status_code == 200
    token = resp.json()["token"]

    children = await client.get(
        "/api/children", headers={"Authorization": f"Bearer {token}"}
    )
    assert children.status_code == 200
    names = [c["name"] for c in children.json()]
    assert "小朋友1" in names
    assert "小朋友2" in names


# ── de-phone auth guards ──────────────────────────────


@pytest.mark.asyncio
async def test_children_no_token_401(client):
    resp = await client.get("/api/children")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_children_invalid_token_401(client):
    resp = await client.get(
        "/api/children", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_children_wrong_scheme_401(client):
    resp = await client.get("/api/children", headers={"Authorization": "Basic abcdef"})
    assert resp.status_code == 401
