"""add grade, note, avatar to children

Revision ID: d6e7f8a9b0c1
Revises: c3d4e5f6a7b8
Create Date: 2026-08-22 00:00:00.000000

X5 (AD-25 contract change 5): ``Child`` gains ``grade`` (required, defaults to
``五年级``), ``note`` (optional, max 200 chars) and ``avatar`` (reserved,
optional, not implemented in v2 — no upload/edit/display). Forward-only; the
downgrade reverses the add-column and is safe (no data migration).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d6e7f8a9b0c1"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "children",
        sa.Column(
            "grade", sa.String(length=20), nullable=False, server_default="五年级"
        ),
    )
    op.add_column("children", sa.Column("note", sa.String(length=200), nullable=True))
    op.add_column("children", sa.Column("avatar", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("children", "avatar")
    op.drop_column("children", "note")
    op.drop_column("children", "grade")
