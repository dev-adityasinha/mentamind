"""Add unique username to users

Adds a nullable, unique username handle. Nullable so existing and anonymous
rows stay valid; a partial-safe unique index enforces uniqueness among the
non-null values.

Revision ID: 2026_07_18_username
Revises: 2026_07_18_reminder_cats
Create Date: 2026-07-18 04:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = "2026_07_18_username"
down_revision = "2026_07_18_reminder_cats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=50), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
