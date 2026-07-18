"""add user ban fields for admin moderation

Revision ID: 2026_07_18_add_user_ban_fields
Revises: 2026_07_15_add_assessment_bank
Create Date: 2026-07-18 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_07_18_add_user_ban_fields"
down_revision = "2026_07_15_add_assessment_bank"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_banned",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "users",
        sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("ban_reason", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "ban_reason")
    op.drop_column("users", "banned_at")
    op.drop_column("users", "is_banned")
