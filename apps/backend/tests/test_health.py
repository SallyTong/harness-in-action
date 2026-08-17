import pytest


@pytest.mark.asyncio
async def test_health_ok(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-homework-grader"
    assert data["version"] == "0.2.0"
