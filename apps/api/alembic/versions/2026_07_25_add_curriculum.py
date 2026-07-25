"""add curriculum tables (30-day guided meditation journey)

Adds two GLOBAL content tables for the Mindful-Architecture meditation module:
  - curriculum_blocks (3 rows: Foundation / Depth / Integration)
  - curriculum_days   (30 rows of per-day content; nested meditation/
                       reflection/task stored as JSONB)

Purely additive: no existing table is touched. Content is seeded separately by
scripts/seed_curriculum.py (idempotent upsert).

Revision ID: 2026_07_25_curriculum
Revises: 2026_07_19_purge_med
Create Date: 2026-07-25 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2026_07_25_curriculum"
down_revision = "2026_07_19_purge_med"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "curriculum_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("block", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("focus", sa.Text(), nullable=False, server_default=""),
        sa.Column("meditation_focus", sa.Text(), nullable=False, server_default=""),
        sa.Column("reflection_focus", sa.Text(), nullable=False, server_default=""),
        sa.Column("task_focus", sa.Text(), nullable=False, server_default=""),
        sa.Column("color", sa.String(length=100), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("block", name="uq_curriculum_block"),
    )

    op.create_table(
        "curriculum_days",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("block", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("theme", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("mood_question", sa.Text(), nullable=False, server_default=""),
        sa.Column("meditation", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("reflection", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("task", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("day", name="uq_curriculum_day"),
    )
    op.create_index("ix_curriculum_days_day", "curriculum_days", ["day"])


def downgrade() -> None:
    op.drop_index("ix_curriculum_days_day", table_name="curriculum_days")
    op.drop_table("curriculum_days")
    op.drop_table("curriculum_blocks")
