"""consent_records table

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-15

Stores an immutable audit trail of every consent grant or withdrawal.
One row is written per consent type per user action; existing rows are
never updated or deleted (cascade from users/organizations only).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSENT_TYPES = ("analytics", "ai_coaching")
_CONSENT_ACTIONS = ("granted", "withdrawn")


def upgrade() -> None:
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("consent_type", sa.String(32), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            f"consent_type IN {_CONSENT_TYPES}",
            name="ck_consent_records_consent_type",
        ),
        sa.CheckConstraint(
            f"action IN {_CONSENT_ACTIONS}",
            name="ck_consent_records_action",
        ),
    )
    op.create_index("ix_consent_records_user_id", "consent_records", ["user_id"])
    op.create_index("ix_consent_records_org_id", "consent_records", ["org_id"])
    op.create_index(
        "ix_consent_records_user_type",
        "consent_records",
        ["user_id", "consent_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_consent_records_user_type", "consent_records")
    op.drop_index("ix_consent_records_org_id", "consent_records")
    op.drop_index("ix_consent_records_user_id", "consent_records")
    op.drop_table("consent_records")
