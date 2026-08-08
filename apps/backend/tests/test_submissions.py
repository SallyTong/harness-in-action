"""Tests for submission upload and query endpoints."""

import io
from unittest.mock import patch

import pytest
from PIL import Image
from sqlalchemy import select

from app.models.graded_question import GradedQuestion
from app.models.submission import Submission

PHONE_A = "13800138000"
PHONE_B = "13900139000"

# Prevent the background grading task from running in tests.
_process_submission_patch = patch(
    "app.routers.submissions.process_submission", lambda submission_id: None
)
_process_submission_patch.start()

MOCK_GLM_RESULT = {
    "questions": [
        {
            "question_number": "1",
            "question_position": {"x": 10.0, "y": 15.0, "w": 80.0, "h": 10.0},
            "question_type": "choice",
            "is_correct": True,
            "solution_note": None,
            "error_category": None,
        },
        {
            "question_number": "2",
            "question_position": {"x": 10.0, "y": 28.0, "w": 80.0, "h": 10.0},
            "question_type": "fill_blank",
            "is_correct": False,
            "solution_note": "正确答案应为 'have gone'。",
            "error_category": "grammar",
        },
        {
            "question_number": "3",
            "question_position": {"x": 10.0, "y": 41.0, "w": 80.0, "h": 12.0},
            "question_type": "reading",
            "is_correct": True,
            "solution_note": None,
            "error_category": None,
        },
    ],
    "token_usage": {
        "prompt_tokens": 1200,
        "completion_tokens": 800,
        "total_tokens": 2000,
    },
    "raw_response": {"choices": [{"message": {"content": "{}"}}]},
}


def _make_jpeg_buf() -> io.BytesIO:
    """Create an in-memory JPEG image."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    img.save(buf, "JPEG", quality=85)
    buf.seek(0)
    return buf


async def _get_first_child_id(client, phone: str) -> int:
    """Get the first child ID for a given phone, triggering auto-create if needed."""
    resp = await client.get(f"/api/children?phone={phone}")
    assert resp.status_code == 200
    children = resp.json()
    assert len(children) > 0
    return children[0]["id"]


@pytest.mark.asyncio
async def test_upload_ok(client, db_session):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = _make_jpeg_buf()
    response = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "pending"
    assert isinstance(data["submission_id"], int)


@pytest.mark.asyncio
async def test_upload_missing_image(client):
    child_id = await _get_first_child_id(client, PHONE_A)
    response = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        data={"subject": "english", "child_id": str(child_id)},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_invalid_subject(client):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = _make_jpeg_buf()
    response = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "invalid_subject", "child_id": str(child_id)},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_invalid_file_type(client):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = io.BytesIO(b"This is not an image file")
    buf.seek(0)
    response = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.txt", buf, "text/plain")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    assert response.status_code == 400
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_upload_child_not_owned(client):
    # Phone A creates a child
    create_resp = await client.post(
        f"/api/children?phone={PHONE_A}", json={"name": "A_child"}
    )
    child_id = create_resp.json()["id"]

    buf = _make_jpeg_buf()
    # Phone B tries to use Phone A's child
    response = await client.post(
        f"/api/submissions?phone={PHONE_B}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_submission_pending(client, db_session):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = _make_jpeg_buf()
    resp = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    submission_id = resp.json()["submission_id"]

    response = await client.get(f"/api/submissions/{submission_id}?phone={PHONE_A}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == submission_id
    assert data["status"] in ("pending", "processing")
    assert data["subject"] == "english"
    assert data["score"] is None
    assert data["questions"] is None


@pytest.mark.asyncio
async def test_get_submission_not_found(client):
    response = await client.get(f"/api/submissions/99999?phone={PHONE_A}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_submission_not_owned(client, db_session):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = _make_jpeg_buf()
    resp = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    submission_id = resp.json()["submission_id"]

    response = await client.get(f"/api/submissions/{submission_id}?phone={PHONE_B}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_submission_completed(client, db_session):
    child_id = await _get_first_child_id(client, PHONE_A)
    buf = _make_jpeg_buf()
    resp = await client.post(
        f"/api/submissions?phone={PHONE_A}",
        files={"image": ("test.jpg", buf, "image/jpeg")},
        data={"subject": "english", "child_id": str(child_id)},
    )
    submission_id = resp.json()["submission_id"]

    # Manually mark as completed with grading data
    result = await db_session.execute(
        select(Submission).where(Submission.id == submission_id)
    )
    sub = result.scalar_one()
    sub.status = "completed"
    sub.total_questions = 3
    sub.correct_count = 2
    sub.token_usage = MOCK_GLM_RESULT["token_usage"]
    sub.annotated_image_path = f"data/images/annotated/{submission_id}.jpg"
    sub.thumbnail_path = f"data/images/thumbnails/{submission_id}.jpg"

    for q in MOCK_GLM_RESULT["questions"]:
        gq = GradedQuestion(
            submission_id=submission_id,
            question_number=q["question_number"],
            question_position=q.get("question_position"),
            question_type=q["question_type"],
            is_correct=q["is_correct"],
            solution_note=q.get("solution_note"),
            error_category=q.get("error_category"),
        )
        db_session.add(gq)

    await db_session.commit()

    response = await client.get(f"/api/submissions/{submission_id}?phone={PHONE_A}")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "completed"
    assert data["score"] == {"correct": 2, "total": 3}
    assert data["total_questions"] == 3
    assert data["correct_count"] == 2
    assert data["token_usage"]["total_tokens"] == 2000
    assert data["annotated_image_url"] is not None
    assert data["questions"] is not None
    assert len(data["questions"]) == 3
    assert data["questions"][0]["question_number"] == "1"
    assert data["questions"][0]["is_correct"] is True
    assert data["questions"][1]["is_correct"] is False
    assert data["questions"][1]["solution_note"] is not None
