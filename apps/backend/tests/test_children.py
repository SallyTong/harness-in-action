import pytest

from tests.helpers import login

PHONE_A = "13800138000"
PHONE_B = "13900139000"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_children_returns_defaults(client):
    token = await login(client, PHONE_A)
    response = await client.get("/api/children", headers=_auth(token))
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [c["name"] for c in data]
    assert "小朋友1" in names
    assert "小朋友2" in names
    for c in data:
        assert c["submission_count"] == 0
        assert c["grade"] == "五年级"
        assert c["note"] is None
        assert c["avatar"] is None
        assert "id" in c
        assert "created_at" in c


@pytest.mark.asyncio
async def test_create_child_ok(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children", json={"name": "小明"}, headers=_auth(token)
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "小明"
    assert data["submission_count"] == 0


@pytest.mark.asyncio
async def test_create_child_duplicate_name_returns_409(client):
    token = await login(client, PHONE_A)
    await client.post("/api/children", json={"name": "小红"}, headers=_auth(token))
    response = await client.post(
        "/api/children", json={"name": "小红"}, headers=_auth(token)
    )
    assert response.status_code == 409
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_create_child_empty_name_returns_422(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children", json={"name": ""}, headers=_auth(token)
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_child_ok(client):
    token = await login(client, PHONE_A)
    create_resp = await client.post(
        "/api/children", json={"name": "旧名字"}, headers=_auth(token)
    )
    child_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/children/{child_id}", json={"name": "新名字"}, headers=_auth(token)
    )
    assert response.status_code == 200
    assert response.json()["name"] == "新名字"


@pytest.mark.asyncio
async def test_update_nonexistent_child_returns_404(client):
    token = await login(client, PHONE_A)
    response = await client.put(
        "/api/children/99999", json={"name": "不管"}, headers=_auth(token)
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_child_ok(client):
    token = await login(client, PHONE_A)
    create_resp = await client.post(
        "/api/children", json={"name": "要删除的"}, headers=_auth(token)
    )
    child_id = create_resp.json()["id"]

    response = await client.delete(f"/api/children/{child_id}", headers=_auth(token))
    assert response.status_code == 204

    list_resp = await client.get("/api/children", headers=_auth(token))
    ids = [c["id"] for c in list_resp.json()]
    assert child_id not in ids


@pytest.mark.asyncio
async def test_delete_nonexistent_child_returns_404(client):
    token = await login(client, PHONE_A)
    response = await client.delete("/api/children/99999", headers=_auth(token))
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_child_with_grade_and_note(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children",
        json={"name": "小明", "grade": "三年级", "note": "数学薄弱"},
        headers=_auth(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["grade"] == "三年级"
    assert data["note"] == "数学薄弱"
    assert data["avatar"] is None


@pytest.mark.asyncio
async def test_create_child_grade_defaults_to_fifth(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children", json={"name": "缺年级"}, headers=_auth(token)
    )
    assert response.status_code == 201
    data = response.json()
    assert data["grade"] == "五年级"
    assert data["note"] is None


@pytest.mark.asyncio
async def test_create_child_invalid_grade_returns_422(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children", json={"name": "坏年级", "grade": "高三"}, headers=_auth(token)
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_child_note_too_long_returns_422(client):
    token = await login(client, PHONE_A)
    response = await client.post(
        "/api/children",
        json={"name": "备注超长", "note": "x" * 201},
        headers=_auth(token),
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_child_grade_and_note(client):
    token = await login(client, PHONE_A)
    create_resp = await client.post(
        "/api/children",
        json={"name": "旧名字", "grade": "一年级", "note": "旧备注"},
        headers=_auth(token),
    )
    child_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/children/{child_id}",
        json={"name": "新名字", "grade": "六年级", "note": "新备注"},
        headers=_auth(token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "新名字"
    assert data["grade"] == "六年级"
    assert data["note"] == "新备注"


@pytest.mark.asyncio
async def test_ownership_isolation(client):
    token_a = await login(client, PHONE_A)
    token_b = await login(client, PHONE_B)
    create_resp = await client.post(
        "/api/children", json={"name": "A的娃"}, headers=_auth(token_a)
    )
    child_id = create_resp.json()["id"]

    put_resp = await client.put(
        f"/api/children/{child_id}", json={"name": "HACKED"}, headers=_auth(token_b)
    )
    assert put_resp.status_code == 404

    delete_resp = await client.delete(
        f"/api/children/{child_id}", headers=_auth(token_b)
    )
    assert delete_resp.status_code == 404


@pytest.mark.asyncio
async def test_parent_b_list_is_independent(client):
    """Parent B should see their own children, not Parent A's."""
    await login(client, PHONE_A)
    token_b = await login(client, PHONE_B)

    create_resp = await client.post(
        "/api/children", json={"name": "B的娃"}, headers=_auth(token_b)
    )
    assert create_resp.status_code == 201

    list_resp = await client.get("/api/children", headers=_auth(token_b))
    names = [c["name"] for c in list_resp.json()]
    assert "B的娃" in names
    assert "小朋友1" in names  # defaults for Phone B
