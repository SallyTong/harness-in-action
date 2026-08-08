import pytest

PHONE_A = "13800138000"
PHONE_B = "13900139000"


@pytest.mark.asyncio
async def test_list_children_returns_defaults(client):
    response = await client.get(f"/api/children?phone={PHONE_A}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [c["name"] for c in data]
    assert "小朋友1" in names
    assert "小朋友2" in names
    for c in data:
        assert c["submission_count"] == 0
        assert "id" in c
        assert "created_at" in c


@pytest.mark.asyncio
async def test_create_child_ok(client):
    response = await client.post(
        f"/api/children?phone={PHONE_A}",
        json={"name": "小明"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "小明"
    assert data["submission_count"] == 0


@pytest.mark.asyncio
async def test_create_child_duplicate_name_returns_409(client):
    await client.post(f"/api/children?phone={PHONE_A}", json={"name": "小红"})
    response = await client.post(
        f"/api/children?phone={PHONE_A}", json={"name": "小红"}
    )
    assert response.status_code == 409
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_create_child_empty_name_returns_422(client):
    response = await client.post(f"/api/children?phone={PHONE_A}", json={"name": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_child_ok(client):
    create_resp = await client.post(
        f"/api/children?phone={PHONE_A}", json={"name": "旧名字"}
    )
    child_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/children/{child_id}?phone={PHONE_A}",
        json={"name": "新名字"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "新名字"


@pytest.mark.asyncio
async def test_update_nonexistent_child_returns_404(client):
    response = await client.put(
        "/api/children/99999?phone=13800138000",
        json={"name": "不管"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_child_ok(client):
    create_resp = await client.post(
        f"/api/children?phone={PHONE_A}", json={"name": "要删除的"}
    )
    child_id = create_resp.json()["id"]

    response = await client.delete(f"/api/children/{child_id}?phone={PHONE_A}")
    assert response.status_code == 204

    list_resp = await client.get(f"/api/children?phone={PHONE_A}")
    ids = [c["id"] for c in list_resp.json()]
    assert child_id not in ids


@pytest.mark.asyncio
async def test_delete_nonexistent_child_returns_404(client):
    response = await client.delete("/api/children/99999?phone=13800138000")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_ownership_isolation(client):
    create_resp = await client.post(
        f"/api/children?phone={PHONE_A}", json={"name": "A的娃"}
    )
    child_id = create_resp.json()["id"]

    put_resp = await client.put(
        f"/api/children/{child_id}?phone={PHONE_B}",
        json={"name": "HACKED"},
    )
    assert put_resp.status_code == 404

    delete_resp = await client.delete(f"/api/children/{child_id}?phone={PHONE_B}")
    assert delete_resp.status_code == 404


@pytest.mark.asyncio
async def test_phone_b_list_is_independent(client):
    """Phone B should see their own children, not Phone A's."""
    # Phone B creates their own child
    create_resp = await client.post(
        f"/api/children?phone={PHONE_B}", json={"name": "B的娃"}
    )
    assert create_resp.status_code == 201

    # Phone B's list should not contain Phone A's children
    list_resp = await client.get(f"/api/children?phone={PHONE_B}")
    names = [c["name"] for c in list_resp.json()]
    assert "B的娃" in names
    assert "小朋友1" in names  # defaults for Phone B


@pytest.mark.asyncio
async def test_invalid_phone_format_returns_422(client):
    response = await client.get("/api/children?phone=123")
    assert response.status_code == 422
