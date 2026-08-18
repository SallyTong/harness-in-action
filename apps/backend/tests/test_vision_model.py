"""Tests for the X2 vision-model abstraction (GLM / Qwen providers).

Both providers are mocked at the HTTP layer — no real GLM/Qwen quota is
consumed. The pipeline test runs ``process_submission`` end-to-end against the
test database with a fake model to prove switching providers does not change
annotation / error-sync output.
"""

import json
import os
import tempfile
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import httpx
import pytest
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.child import Child
from app.models.error_question import ErrorQuestion
from app.models.graded_question import GradedQuestion
from app.models.parent import Parent
from app.models.submission import Submission
from app.schemas.submissions import SubmissionResponse
from app.services import grading as grading_mod
from app.services.vision import (
    GradedQuestionData,
    GradingResult,
    TokenUsage,
    VisionModelError,
    VisionModelExtractor,
    get_vision_model,
)
from app.services.vision.base import question_from_dict
from app.services.vision.factory import _resolve_model
from app.services.vision.glm import GLMVisionModel
from app.services.vision.qwen import QwenVisionModel

QUESTIONS = [
    {
        "question_number": "1",
        "question_position": {"x": 10.0, "y": 15.0, "w": 80.0, "h": 10.0},
        "question_type": "choice",
        "is_correct": True,
        "solution_note": None,
        "error_category": None,
        "question_text": "What is your name?",
        "question_latex": None,
    },
    {
        "question_number": "2",
        "question_position": {"x": 10.0, "y": 28.0, "w": 80.0, "h": 10.0},
        "question_type": "fill_blank",
        "is_correct": False,
        "solution_note": "正确答案应为 'have gone'。",
        "error_category": "grammar",
        "question_text": "Fill in the blank: have ___ gone.",
        "question_latex": None,
    },
]

USAGE = {"prompt_tokens": 1200, "completion_tokens": 800, "total_tokens": 2000}
PLAIN_CONTENT = json.dumps({"questions": QUESTIONS})
FENCED_CONTENT = "```json\n" + PLAIN_CONTENT + "\n```"


class _FakeResponse:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


def _response(content: str, usage: dict | None = None) -> dict:
    return {
        "choices": [{"message": {"content": content}}],
        "usage": usage or USAGE,
    }


class _FakeVisionModel:
    def __init__(self, result: GradingResult):
        self._result = result

    async def grade(self, image, subject):
        assert isinstance(image, bytes)
        return self._result


@pytest.mark.asyncio
async def test_glm_grade_returns_grading_result(monkeypatch):
    monkeypatch.setenv("GLM_API_KEY", "test-key")
    post = AsyncMock(return_value=_FakeResponse(_response(FENCED_CONTENT)))
    monkeypatch.setattr(httpx.AsyncClient, "post", post)

    result = await GLMVisionModel().grade(b"fake-jpeg-bytes", "english")

    assert isinstance(result, GradingResult)
    assert len(result.questions) == 2
    assert result.questions[0].is_correct is True
    assert result.questions[1].is_correct is False
    assert result.questions[1].solution_note == "正确答案应为 'have gone'。"
    assert result.questions[1].error_category == "grammar"
    assert result.questions[0].question_text == "What is your name?"
    assert result.questions[0].question_latex is None

    assert result.token_usage.provider == "glm"
    assert result.token_usage.model == "glm-4v-flash"
    assert result.token_usage.prompt_tokens == 1200
    assert result.token_usage.total_tokens == 2000

    # Request payload sanity: model + base64 image + prompt
    payload = post.call_args.kwargs["json"]
    assert payload["model"] == "glm-4v-flash"
    image_url = payload["messages"][1]["content"][0]["image_url"]["url"]
    assert image_url.startswith("data:image/jpeg;base64,")


@pytest.mark.asyncio
async def test_qwen_grade_returns_grading_result(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "test-key")
    post = AsyncMock(return_value=_FakeResponse(_response(PLAIN_CONTENT)))
    monkeypatch.setattr(httpx.AsyncClient, "post", post)

    result = await QwenVisionModel().grade(b"fake-jpeg-bytes", "math")

    assert isinstance(result, GradingResult)
    assert len(result.questions) == 2
    assert result.questions[0].question_number == "1"
    assert result.token_usage.provider == "qwen"
    assert result.token_usage.model == "qwen-vl-max"

    payload = post.call_args.kwargs["json"]
    assert payload["model"] == "qwen-vl-max"


@pytest.mark.asyncio
async def test_glm_and_qwen_output_schema_identical(monkeypatch):
    monkeypatch.setenv("GLM_API_KEY", "glm-key")
    monkeypatch.setenv("QWEN_API_KEY", "qwen-key")

    glm_post = AsyncMock(return_value=_FakeResponse(_response(PLAIN_CONTENT)))
    monkeypatch.setattr(httpx.AsyncClient, "post", glm_post)
    glm_result = await GLMVisionModel().grade(b"img", "english")

    qwen_post = AsyncMock(return_value=_FakeResponse(_response(PLAIN_CONTENT)))
    monkeypatch.setattr(httpx.AsyncClient, "post", qwen_post)
    qwen_result = await QwenVisionModel().grade(b"img", "english")

    # Identical question schema, only provider/model in token_usage differ.
    assert [asdict(q) for q in glm_result.questions] == [
        asdict(q) for q in qwen_result.questions
    ]
    assert glm_result.token_usage.provider == "glm"
    assert qwen_result.token_usage.provider == "qwen"

    # Prompt alignment (AC-X2.3)
    glm_prompt = glm_post.call_args.kwargs["json"]["messages"][0]["content"]
    qwen_prompt = qwen_post.call_args.kwargs["json"]["messages"][0]["content"]
    assert glm_prompt == qwen_prompt


@pytest.mark.asyncio
async def test_glm_grade_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("GLM_API_KEY", raising=False)
    with pytest.raises(VisionModelError):
        await GLMVisionModel().grade(b"img", "english")


@pytest.mark.asyncio
async def test_qwen_grade_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)
    with pytest.raises(VisionModelError):
        await QwenVisionModel().grade(b"img", "english")


@pytest.mark.asyncio
async def test_grade_http_error_raises_after_retry(monkeypatch):
    monkeypatch.setenv("GLM_API_KEY", "test-key")

    async def _boom(*args, **kwargs):
        raise httpx.HTTPError("boom")

    post = AsyncMock(side_effect=_boom)
    monkeypatch.setattr(httpx.AsyncClient, "post", post)

    with pytest.raises(VisionModelError):
        await GLMVisionModel().grade(b"img", "english")
    assert post.call_count == 2  # one retry then give up


def test_factory_defaults_to_glm(monkeypatch):
    monkeypatch.delenv("VISION_PROVIDER", raising=False)
    assert isinstance(get_vision_model(), GLMVisionModel)


def test_factory_selects_qwen(monkeypatch):
    monkeypatch.setenv("VISION_PROVIDER", "qwen")
    assert isinstance(get_vision_model(), QwenVisionModel)


def test_factory_unknown_provider_falls_back_to_glm(monkeypatch):
    monkeypatch.setenv("VISION_PROVIDER", "openai")
    assert isinstance(get_vision_model(), GLMVisionModel)


def test_factory_model_resolution(monkeypatch):
    monkeypatch.delenv("VISION_MODEL", raising=False)
    monkeypatch.delenv("GLM_MODEL", raising=False)
    assert _resolve_model("glm") == "glm-4v-flash"
    assert _resolve_model("qwen") == "qwen-vl-max"

    # VISION_MODEL overrides both providers.
    monkeypatch.setenv("VISION_MODEL", "qwen-vl-plus")
    assert _resolve_model("glm") == "qwen-vl-plus"
    assert _resolve_model("qwen") == "qwen-vl-plus"

    # Legacy GLM_MODEL only affects glm.
    monkeypatch.delenv("VISION_MODEL", raising=False)
    monkeypatch.setenv("GLM_MODEL", "glm-4v-plus")
    assert _resolve_model("glm") == "glm-4v-plus"
    assert _resolve_model("qwen") == "qwen-vl-max"


def test_token_usage_to_dict_includes_provider_model():
    usage = TokenUsage(
        provider="qwen",
        model="qwen-vl-max",
        prompt_tokens=1,
        completion_tokens=2,
        total_tokens=3,
    )
    assert usage.to_dict() == {
        "provider": "qwen",
        "model": "qwen-vl-max",
        "prompt_tokens": 1,
        "completion_tokens": 2,
        "total_tokens": 3,
    }


def test_token_usage_legacy_record_still_readable():
    """Pre-X2 token_usage records lack provider/model and must still be served."""
    legacy = {"prompt_tokens": 1200, "completion_tokens": 800, "total_tokens": 2000}
    resp = SubmissionResponse(
        id=1,
        child_id=1,
        child_name="x",
        subject="english",
        status="completed",
        score=None,
        thumbnail_url=None,
        created_at=datetime.now(timezone.utc),
        original_image_url="",
        annotated_image_url=None,
        total_questions=3,
        correct_count=2,
        token_usage=legacy,
        questions=None,
        updated_at=None,
    )
    assert resp.token_usage == legacy
    assert "provider" not in resp.token_usage


def test_graded_result_conversion_shape():
    """The pipeline's dict view of a question carries every field downstream needs."""
    result = GradingResult(
        questions=[
            GradedQuestionData(
                question_number="1",
                question_position={"x": 1, "y": 2, "w": 3, "h": 4},
                question_type="choice",
                is_correct=True,
                solution_note=None,
                error_category=None,
            )
        ],
        raw_json={},
        token_usage=TokenUsage(provider="glm", model="glm-4v-flash"),
    )
    question = asdict(result.questions[0])
    assert set(question.keys()) == {
        "question_number",
        "question_position",
        "question_type",
        "is_correct",
        "solution_note",
        "error_category",
        "question_text",
        "question_latex",
    }
    # question_text/question_latex are optional; None when the model omits them.
    assert question["question_text"] is None
    assert question["question_latex"] is None


def test_question_from_dict_parses_question_text():
    q = question_from_dict(
        {
            "question_number": "3",
            "question_type": "word_problem",
            "is_correct": False,
            "question_text": "Tom has 5 apples.",
            "question_latex": "x^2 + y = 3",
        }
    )
    assert q.question_text == "Tom has 5 apples."
    assert q.question_latex == "x^2 + y = 3"

    # Handwriting / graphic questions may omit the fields → None, not an error.
    q2 = question_from_dict(
        {"question_number": "4", "question_type": "choice", "is_correct": True}
    )
    assert q2.question_text is None
    assert q2.question_latex is None


@pytest.mark.asyncio
async def test_vision_model_extractor_returns_question_text():
    q = GradedQuestionData(
        question_number="1",
        question_position=None,
        question_type="choice",
        is_correct=True,
        solution_note=None,
        error_category=None,
        question_text="What is your name?",
        question_latex=None,
    )
    text = await VisionModelExtractor(q).extract(b"img", "english")
    assert text.question_text == "What is your name?"
    assert text.question_latex is None


@pytest.mark.asyncio
async def test_process_submission_pipeline_agnostic_to_provider(monkeypatch):
    """Switching providers must not change annotation / error-sync output."""
    engine = create_async_engine(
        os.getenv(
            "TEST_DATABASE_URL",
            "mysql+aiomysql://root:homework_dev@localhost:3306/homework_grader_test",
        ),
        echo=False,
        poolclass=NullPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    questions = [
        GradedQuestionData(
            question_number="1",
            question_position={"x": 10.0, "y": 15.0, "w": 80.0, "h": 10.0},
            question_type="choice",
            is_correct=True,
            solution_note=None,
            error_category=None,
        ),
        GradedQuestionData(
            question_number="2",
            question_position={"x": 10.0, "y": 28.0, "w": 80.0, "h": 10.0},
            question_type="fill_blank",
            is_correct=False,
            solution_note="正确答案应为 'have gone'。",
            error_category="grammar",
            question_text="Fill in the blank: have ___ gone.",
            question_latex="x^2 + y = 3",
        ),
    ]

    @asynccontextmanager
    async def _test_db():
        async with session_factory() as session:
            yield session

    monkeypatch.setattr(grading_mod, "get_db_session", _test_db)

    created_sids: list[int] = []

    try:
        with tempfile.TemporaryDirectory() as tmp:
            orig = os.path.join(tmp, "orig.jpg")
            Image.new("RGB", (200, 200), "white").save(orig, "JPEG")

            monkeypatch.setattr(grading_mod, "IMAGE_ORIGINALS", f"{tmp}/originals")
            monkeypatch.setattr(grading_mod, "IMAGE_ANNOTATED", f"{tmp}/annotated")
            monkeypatch.setattr(grading_mod, "IMAGE_THUMBNAILS", f"{tmp}/thumbnails")
            monkeypatch.setattr(grading_mod, "IMAGE_QUESTIONS", f"{tmp}/questions")

            for idx, provider in enumerate(("glm", "qwen")):
                result = GradingResult(
                    questions=questions,
                    raw_json={"provider": provider},
                    token_usage=TokenUsage(
                        provider=provider,
                        model=f"{provider}-model",
                        prompt_tokens=1,
                        completion_tokens=1,
                        total_tokens=2,
                    ),
                )

                monkeypatch.setattr(
                    grading_mod,
                    "get_vision_model",
                    lambda r=result: _FakeVisionModel(r),
                )

                async with session_factory() as session:
                    parent = Parent(phone=f"1320000000{idx}")
                    session.add(parent)
                    await session.flush()
                    child = Child(parent_id=parent.id, name="x")
                    session.add(child)
                    await session.flush()
                    submission = Submission(
                        child_id=child.id,
                        subject="english",
                        status="pending",
                        original_image_path=orig,
                    )
                    session.add(submission)
                    await session.flush()
                    sid = submission.id
                    await session.commit()
                created_sids.append(sid)

                await grading_mod.process_submission(sid)

                async with session_factory() as session:
                    sub = (
                        await session.execute(
                            select(Submission).where(Submission.id == sid)
                        )
                    ).scalar_one()
                    graded = (
                        (
                            await session.execute(
                                select(GradedQuestion)
                                .where(GradedQuestion.submission_id == sid)
                                .order_by(GradedQuestion.id)
                            )
                        )
                        .scalars()
                        .all()
                    )
                    errors = (
                        (
                            await session.execute(
                                select(ErrorQuestion).where(
                                    ErrorQuestion.submission_id == sid
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )

                assert sub.status == "completed"
                assert sub.correct_count == 1
                assert sub.total_questions == 2
                assert len(graded) == 2
                assert len(errors) == 1  # only the wrong question is synced
                assert errors[0].question_number == "2"
                assert errors[0].error_category == "grammar"
                # X3 (AD-23): question text lands in both tables, consistently.
                assert graded[1].question_text == "Fill in the blank: have ___ gone."
                assert graded[1].question_latex == "x^2 + y = 3"
                assert errors[0].question_text == graded[1].question_text
                assert errors[0].question_latex == graded[1].question_latex
                assert sub.token_usage["provider"] == provider
                assert sub.token_usage["model"] == f"{provider}-model"
                assert os.path.isfile(sub.annotated_image_path)
                assert os.path.isfile(sub.thumbnail_path)
    finally:
        async with session_factory() as session:
            if created_sids:
                await session.execute(
                    delete(ErrorQuestion).where(
                        ErrorQuestion.submission_id.in_(created_sids)
                    )
                )
                await session.execute(
                    delete(GradedQuestion).where(
                        GradedQuestion.submission_id.in_(created_sids)
                    )
                )
                await session.execute(
                    delete(Submission).where(Submission.id.in_(created_sids))
                )
                await session.commit()
        await engine.dispose()
