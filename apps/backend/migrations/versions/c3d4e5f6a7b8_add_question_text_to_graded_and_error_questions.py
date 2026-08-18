"""add question_text to graded and error questions

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-08-18 00:00:00.000000

X3 (AD-23/AD-24): the grading prompt now makes the vision model output the full
question text as a by-product of grading — ``question_text`` (English, plain
text) and ``question_latex`` (Math, LaTeX). Both are nullable because hand-written
or purely graphic questions may not transcribe cleanly.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "graded_questions", sa.Column("question_text", sa.Text(), nullable=True)
    )
    op.add_column(
        "graded_questions", sa.Column("question_latex", sa.Text(), nullable=True)
    )
    op.add_column(
        "error_questions", sa.Column("question_text", sa.Text(), nullable=True)
    )
    op.add_column(
        "error_questions", sa.Column("question_latex", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("error_questions", "question_latex")
    op.drop_column("error_questions", "question_text")
    op.drop_column("graded_questions", "question_latex")
    op.drop_column("graded_questions", "question_text")
