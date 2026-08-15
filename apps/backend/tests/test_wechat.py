import pytest

from app.routers import wechat as wechat_router
from app.services.wechat_client import WechatCodeError, WechatServiceError

PHONE_A = "13800138000"
PHONE_B = "13900139000"
OPENID_A = "openid-aaa"
OPENID_B = "openid-bbb"


def _mock_code2session(
    monkeypatch, *, openid: str | None = None, exc: Exception | None = None
):
    """Replace wechat_router.code2session with a fake returning `openid` or raising `exc`."""

    async def fake(code: str) -> str:
        if exc is not None:
            raise exc
        return openid  # type: ignore[return-value]

    monkeypatch.setattr(wechat_router, "code2session", fake)


@pytest.mark.asyncio
async def test_wechat_login_bind_creates_parent_with_default_children(
    client, monkeypatch
):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A}
    )
    assert resp.status_code == 200
    assert resp.json() == {"phone": PHONE_A}

    children = await client.get(f"/api/children?phone={PHONE_A}")
    assert children.status_code == 200
    names = [c["name"] for c in children.json()]
    assert "小朋友1" in names
    assert "小朋友2" in names


@pytest.mark.asyncio
async def test_wechat_login_silent_returns_bound_phone(client, monkeypatch):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    await client.post("/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A})

    resp = await client.post("/api/wechat-login", json={"code": "wx-code-2"})
    assert resp.status_code == 200
    assert resp.json() == {"phone": PHONE_A}


@pytest.mark.asyncio
async def test_wechat_login_silent_unbound_returns_404(client, monkeypatch):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    resp = await client.post("/api/wechat-login", json={"code": "wx-code"})
    assert resp.status_code == 404
    assert "detail" in resp.json()


@pytest.mark.asyncio
async def test_wechat_login_invalid_code_returns_401(client, monkeypatch):
    _mock_code2session(monkeypatch, exc=WechatCodeError("invalid code"))
    resp = await client.post(
        "/api/wechat-login", json={"code": "bad-code", "phone": PHONE_A}
    )
    assert resp.status_code == 401
    assert "detail" in resp.json()


@pytest.mark.asyncio
async def test_wechat_login_service_unavailable_returns_502(client, monkeypatch):
    _mock_code2session(monkeypatch, exc=WechatServiceError("upstream down"))
    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A}
    )
    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_wechat_login_binds_existing_web_phone(client, monkeypatch):
    # A Web user already exists (auto-created by listing children for a fresh phone).
    await client.get(f"/api/children?phone={PHONE_A}")

    _mock_code2session(monkeypatch, openid=OPENID_A)
    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A}
    )
    assert resp.status_code == 200
    assert resp.json() == {"phone": PHONE_A}

    silent = await client.post("/api/wechat-login", json={"code": "wx-code-2"})
    assert silent.json() == {"phone": PHONE_A}


@pytest.mark.asyncio
async def test_wechat_login_rebind_openid_to_new_phone(client, monkeypatch):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    await client.post("/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A})

    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": PHONE_B}
    )
    assert resp.status_code == 200
    assert resp.json() == {"phone": PHONE_B}

    silent = await client.post("/api/wechat-login", json={"code": "wx-code"})
    assert silent.json() == {"phone": PHONE_B}


@pytest.mark.asyncio
async def test_wechat_login_rebind_conflict_moves_openid_to_existing_phone(
    client, monkeypatch
):
    # openid_A already bound to phone A; phone B already exists as a separate
    # Web/phone parent (no openid). Rebinding openid_A to phone B hits the
    # distinct-rows branch: only the login key moves, data does NOT.
    _mock_code2session(monkeypatch, openid=OPENID_A)
    await client.post("/api/wechat-login", json={"code": "wx-code", "phone": PHONE_A})
    await client.get(f"/api/children?phone={PHONE_B}")  # auto-create phone B parent

    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": PHONE_B}
    )
    assert resp.status_code == 200
    assert resp.json() == {"phone": PHONE_B}

    # openid_A now resolves to phone B; phone A lost its WeChat login key.
    silent = await client.post("/api/wechat-login", json={"code": "wx-code-2"})
    assert silent.status_code == 200
    assert silent.json() == {"phone": PHONE_B}

    # phone A keeps its own data (default children still there) — data did not move.
    a_children = await client.get(f"/api/children?phone={PHONE_A}")
    assert a_children.status_code == 200
    names = [c["name"] for c in a_children.json()]
    assert "小朋友1" in names and "小朋友2" in names


@pytest.mark.asyncio
async def test_wechat_login_missing_code_returns_422(client, monkeypatch):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    resp = await client.post("/api/wechat-login", json={"phone": PHONE_A})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_wechat_login_invalid_phone_returns_422(client, monkeypatch):
    _mock_code2session(monkeypatch, openid=OPENID_A)
    resp = await client.post(
        "/api/wechat-login", json={"code": "wx-code", "phone": "123"}
    )
    assert resp.status_code == 422
