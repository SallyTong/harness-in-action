"""add openid to parents

Revision ID: a1b2c3d4e5f6
Revises: e6eae8925c17
Create Date: 2026-08-15 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e6eae8925c17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("parents", sa.Column("openid", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_parent_openid", "parents", ["openid"])


def downgrade() -> None:
    op.drop_constraint("uq_parent_openid", "parents", type_="unique")
    op.drop_column("parents", "openid")
