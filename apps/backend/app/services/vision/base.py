"""Vision model abstraction — provider-agnostic interface + result types.

The grading pipeline depends only on this module, never on a concrete provider.
Concrete implementations (``glm.py`` / ``qwen.py``) are selected at runtime by
``factory.get_vision_model()`` (see AD-21).
"""

import json
from dataclasses import dataclass
from typing import Literal, Protocol

# Exam subjects, matching the DB ``subject_enum``.
Subject = Literal["english", "math"]


class VisionModelError(Exception):
    """Raised when a vision provider call or response parse fails."""


@dataclass
class TokenUsage:
    """Token consumption for one grading call, tagged with provider + model.

    Pre-X2 records (stored as bare ``prompt_tokens`` / ``completion_tokens`` /
    ``total_tokens``) lack ``provider`` / ``model``; readers must tolerate that
    (see AD-22).
    """

    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass
class GradedQuestionData:
    """One graded question, normalized from the provider's raw output.

    ``question_text`` (English, plain text) / ``question_latex`` (Math, LaTeX) are
    emitted by the vision model alongside the grade (X3, AD-23/AD-24). Both are
    optional — hand-written or graphic questions may not transcribe.
    """

    question_number: str
    question_position: dict | None
    question_type: str
    is_correct: bool
    solution_note: str | None
    error_category: str | None
    question_text: str | None = None
    question_latex: str | None = None


@dataclass
class GradingResult:
    """Structured result of one grading call."""

    questions: list[GradedQuestionData]
    raw_json: dict
    token_usage: TokenUsage


class VisionModel(Protocol):
    """Provider-agnostic visual grading model (AD-21)."""

    provider: str

    async def grade(self, image: bytes, subject: Subject) -> GradingResult: ...


def parse_questions(content: str) -> list[dict]:
    """Strip markdown fences and parse the model's JSON into a question list.

    Accepts either ``{"questions": [...]}`` or a bare ``[...]``, matching what
    both GLM-4V and Qwen-VL return.
    """
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content[:-3].strip()
        if content.startswith("json\n"):
            content = content[5:].strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise VisionModelError(
            f"Failed to parse vision model response as JSON: {e}\n"
            f"Content: {content[:500]}"
        ) from e

    if isinstance(parsed, list):
        questions = parsed
    elif isinstance(parsed, dict):
        questions = parsed.get("questions", [])
    else:
        raise VisionModelError(f"Unexpected response type: {type(parsed).__name__}")

    if not isinstance(questions, list):
        raise VisionModelError(
            f"Expected 'questions' to be a list, got {type(questions).__name__}"
        )
    return questions


def question_from_dict(q: dict) -> GradedQuestionData:
    """Build a ``GradedQuestionData`` from a raw provider question dict.

    ``question_number`` / ``question_type`` are coerced to ``str``; the remaining
    fields are passed through raw and sanitized later by the grading pipeline.
    """
    return GradedQuestionData(
        question_number=str(q.get("question_number") or ""),
        question_position=q.get("question_position"),
        question_type=str(q.get("question_type") or ""),
        is_correct=q.get("is_correct", False),
        solution_note=q.get("solution_note"),
        error_category=q.get("error_category"),
        question_text=q.get("question_text"),
        question_latex=q.get("question_latex"),
    )
