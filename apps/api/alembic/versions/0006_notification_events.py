"""notification_events table

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-15

Stores in-app notification records per user. Body text is AES-256-GCM
encrypted at the application layer (same pattern as mood_log.context_encrypted).
The table is append-only from a notification-send perspective; the only
mutation is setting is_read + read_at when the user acknowledges a record.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CATEGORIES = (
    "checkin_reminder",
    "burnout_alert",
    "appointment_reminder",
    "wellness_tip",
    "consent_update",
)


def upgrade() -> None:
    op.create_table(
        "notification_events",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body_encrypted", sa.String(2048), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
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
            f"category IN {_CATEGORIES}",
            name="ck_notification_events_category",
        ),
    )
    op.create_index(
        "ix_notification_events_user_id", "notification_events", ["user_id"]
    )
    op.create_index("ix_notification_events_org_id", "notification_events", ["org_id"])
    op.create_index(
        "ix_notification_events_user_unread",
        "notification_events",
        ["user_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_notification_events_user_unread", "notification_events")
    op.drop_index("ix_notification_events_org_id", "notification_events")
    op.drop_index("ix_notification_events_user_id", "notification_events")
    op.drop_table("notification_events")
