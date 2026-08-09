from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.parent import Parent
    from app.models.submission import Submission


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parents.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint("parent_id", "name", name="uq_child_parent_name"),
    )

    parent: Mapped[Parent] = relationship(back_populates="children", lazy="raise")
    submissions: Mapped[list[Submission]] = relationship(
        back_populates="child", lazy="raise"
    )
