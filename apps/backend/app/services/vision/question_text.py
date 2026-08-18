"""Question-text extraction seam (AD-24).

The grading prompt already makes the vision model output each question's full
text as a by-product of grading. ``QuestionTextExtractor`` is the abstraction
where a standalone OCR engine can later be plugged in without touching the
pipeline; the current ``VisionModelExtractor`` just surfaces those
already-transcribed fields (no extra API call).
"""

from dataclasses import dataclass
from typing import Protocol

from app.services.vision.base import GradedQuestionData, Subject


@dataclass
class QuestionText:
    """Transcribed question text for one question (AD-23)."""

    question_text: str | None = None  # English: plain text
    question_latex: str | None = None  # Math: LaTeX


class QuestionTextExtractor(Protocol):
    """Where a question's text comes from — vision model now, OCR later (AD-24)."""

    async def extract(self, image: bytes, subject: Subject) -> QuestionText: ...


class VisionModelExtractor:
    """Current implementation: reuse text the vision model emitted while grading.

    No extra API call is made — the text already rides along with the grading
    result (``GradedQuestionData.question_text`` / ``question_latex``).
    """

    def __init__(self, question: GradedQuestionData):
        self._question = question

    async def extract(self, image: bytes, subject: Subject) -> QuestionText:
        return QuestionText(
            question_text=self._question.question_text,
            question_latex=self._question.question_latex,
        )


# class OCRExtractor:  # AD-24 reserved — plug PaddleOCR / MinerU in here.
#     """Standalone OCR for questions the vision model can't transcribe (AD-24)."""
#     async def extract(self, image: bytes, subject: Subject) -> QuestionText: ...
