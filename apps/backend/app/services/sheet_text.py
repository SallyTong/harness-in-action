"""Text-sheet assembly (X4, AD-25).

A text sheet is assembled from the transcribed question text already stored on
``ErrorQuestion`` (``question_text`` for English / ``question_latex`` for Math)
— no LLM call. Each entry resolves its subject-specific text and flags questions
whose text is missing or blank, so the caller can fall back to the cropped
question screenshot ("残缺题干回退题目截图").

This module is pure data mapping: it performs no filesystem I/O, no URL signing,
and no image rendering. Selection (random sampling) and ownership filtering are
the caller's responsibility.
"""

from dataclasses import dataclass

SUBJECT_LABELS = {"english": "英语", "math": "数学"}

TYPE_LABELS = {
    "choice": "选择题",
    "fill_blank": "填空题",
    "reading": "阅读理解",
    "composition": "作文",
    "calculation": "计算题",
    "word_problem": "应用题",
}

TITLE = "错题练习试卷"
ANSWER_HINT = "作答区域"


@dataclass
class SheetQuestionData:
    """A single error question resolved for text-sheet output."""

    question_number: str
    question_type: str
    subject: str
    question_text: str | None
    question_latex: str | None
    question_image_path: str | None
    source_submission_id: int

    @property
    def primary_text(self) -> str | None:
        """The subject-specific transcribed text (Math uses LaTeX)."""
        return self.question_latex if self.subject == "math" else self.question_text

    @property
    def is_incomplete(self) -> bool:
        """True when the question has no usable transcribed text.

        Such questions rely on the cropped question screenshot as their body.
        """
        return not (self.primary_text or "").strip()


def assemble_sheet_questions(errors) -> list[SheetQuestionData]:
    """Map ErrorQuestion ORM objects into ``SheetQuestionData`` entries.

    ``errors`` is any iterable of ORM objects exposing ``question_number``,
    ``question_type``, ``subject``, ``question_text``, ``question_latex``,
    ``question_image_path`` and ``submission_id``. The caller decides ordering
    and which rows to include (random sample of already-ownership-filtered rows).
    """
    return [
        SheetQuestionData(
            question_number=eq.question_number,
            question_type=eq.question_type,
            subject=eq.subject,
            question_text=eq.question_text,
            question_latex=eq.question_latex,
            question_image_path=eq.question_image_path or None,
            source_submission_id=eq.submission_id,
        )
        for eq in errors
    ]
