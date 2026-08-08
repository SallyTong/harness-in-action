from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.submission import Submission


class GradedQuestion(Base):
    __tablename__ = "graded_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False
    )
    question_number: Mapped[str] = mapped_column(String(20), nullable=False)
    question_position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    question_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    question_type: Mapped[str] = mapped_column(
        Enum(
            "choice",
            "fill_blank",
            "reading",
            "composition",
            "calculation",
            "word_problem",
            name="question_type_enum",
        ),
        nullable=False,
    )
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    solution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_manually_fixed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    submission: Mapped[Submission] = relationship(
        back_populates="graded_questions", lazy="raise"
    )

    __table_args__ = (
        Index("idx_gq_submission_id", "submission_id"),
        Index("idx_gq_submission_correct", "submission_id", "is_correct"),
    )
