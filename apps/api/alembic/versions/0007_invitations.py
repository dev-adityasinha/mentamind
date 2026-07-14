"""invitations table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-16

Stores pending/accepted/revoked invite records. The raw token is never stored;
only its SHA-256 hex digest is kept. Email is stored as a hash for lookup and
AES-256-GCM ciphertext (AAD = org_id.bytes) for display in admin UI.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STATUS_VALUES = "('pending', 'accepted', 'revoked')"
_ROLE_VALUES = (
    "('employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student')"
)


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("email_hash", sa.String(64), nullable=False),
        sa.Column("email_encrypted", sa.Text(), nullable=False),
        sa.Column("invited_role", sa.String(64), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            f"status IN {_STATUS_VALUES}",
            name="ck_invitations_status",
        ),
        sa.CheckConstraint(
            f"invited_role IN {_ROLE_VALUES}",
            name="ck_invitations_invited_role",
        ),
    )
    op.create_index("ix_invitations_org_id", "invitations", ["org_id"])
    op.create_index(
        "ix_invitations_token_hash", "invitations", ["token_hash"], unique=True
    )
    op.create_index("ix_invitations_org_email", "invitations", ["org_id", "email_hash"])


def downgrade() -> None:
    op.drop_index("ix_invitations_org_email", "invitations")
    op.drop_index("ix_invitations_token_hash", "invitations")
    op.drop_index("ix_invitations_org_id", "invitations")
    op.drop_table("invitations")
