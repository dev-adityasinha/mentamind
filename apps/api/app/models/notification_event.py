import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class NotificationCategory(StrEnum):
    CHECKIN_REMINDER = "checkin_reminder"
    BURNOUT_ALERT = "burnout_alert"
    APPOINTMENT_REMINDER = "appointment_reminder"
    WELLNESS_TIP = "wellness_tip"
    CONSENT_UPDATE = "consent_update"
    JOURNAL_PROMPT = "journal_prompt"
    COACH_SESSION = "coach_session"
    STREAK_MILESTONE = "streak_milestone"
    COMMUNITY_REPLY = "community_reply"


class NotificationChannel(StrEnum):
    PUSH = "push"
    EMAIL = "email"
    SLACK = "slack"
    TEAMS = "teams"
    IN_APP = "in_app"


# Max sends per user per category per 24-hour rolling window.
CATEGORY_RATE_CAP: dict[NotificationCategory, int] = {
    NotificationCategory.CHECKIN_REMINDER: 3,
    NotificationCategory.BURNOUT_ALERT: 2,
    NotificationCategory.APPOINTMENT_REMINDER: 5,
    NotificationCategory.WELLNESS_TIP: 3,
    NotificationCategory.CONSENT_UPDATE: 10,
    NotificationCategory.JOURNAL_PROMPT: 1,
    NotificationCategory.COACH_SESSION: 2,
    NotificationCategory.STREAK_MILESTONE: 1,
    NotificationCategory.COMMUNITY_REPLY: 20,
}


class NotificationEvent(Base):
    __tablename__ = "notification_events"

    __table_args__ = (
        CheckConstraint(
            "category IN ('checkin_reminder', 'burnout_alert', "
            "'appointment_reminder', 'wellness_tip', 'consent_update', "
            "'journal_prompt', 'coach_session', 'streak_milestone', 'community_reply')",
            name="ck_notification_events_category",
        ),
        Index("ix_notification_events_user_id", "user_id"),
        Index("ix_notification_events_org_id", "org_id"),
        Index("ix_notification_events_user_unread", "user_id", "is_read"),
        Index("ix_notification_events_channel", "channel"),
        Index("ix_notification_events_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[NotificationCategory] = mapped_column(
        PgEnum(NotificationCategory), nullable=False
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        PgEnum(NotificationChannel), nullable=False, default=NotificationChannel.IN_APP
    )
    template_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body_encrypted: Mapped[str] = mapped_column(String(2048), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
