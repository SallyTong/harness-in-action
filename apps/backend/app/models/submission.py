from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.child import Child
    from app.models.graded_question import GradedQuestion


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), nullable=False)
    subject: Mapped[str] = mapped_column(
        Enum("english", "math", name="subject_enum"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "processing",
            "completed",
            "failed",
            name="submission_status_enum",
        ),
        default="pending",
        nullable=False,
    )
    original_image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    annotated_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    total_questions: Mapped[int | None] = mapped_column(nullable=True)
    correct_count: Mapped[int | None] = mapped_column(nullable=True)
    grading_raw_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    token_usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    child: Mapped[Child] = relationship(back_populates="submissions", lazy="raise")
    graded_questions: Mapped[list[GradedQuestion]] = relationship(
        back_populates="submission", lazy="raise", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_submission_child_id", "child_id"),
        Index("idx_submission_status", "status"),
        Index("idx_submission_created_at", "created_at"),
        Index("idx_submission_child_subject", "child_id", "subject"),
    )
