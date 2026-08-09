from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class ErrorQuestion(Base):
    __tablename__ = "error_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id"), nullable=False
    )
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), nullable=False)
    subject: Mapped[str] = mapped_column(
        Enum("english", "math", name="error_subject_enum"), nullable=False
    )
    question_number: Mapped[str] = mapped_column(String(50), nullable=False)
    question_type: Mapped[str] = mapped_column(
        Enum(
            "choice",
            "fill_blank",
            "reading",
            "composition",
            "calculation",
            "word_problem",
            name="error_question_type_enum",
        ),
        nullable=False,
    )
    question_image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    solution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_manually_fixed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    error_timestamps: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    last_error_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint(
            "submission_id", "question_number", name="uq_eq_submission_question"
        ),
        Index("idx_eq_child_subject", "child_id", "subject"),
        Index("idx_eq_child_type", "child_id", "question_type"),
        Index("idx_eq_last_error", "last_error_at"),
    )
