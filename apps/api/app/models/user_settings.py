import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ThemeMode(StrEnum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    theme: Mapped[ThemeMode] = mapped_column(nullable=False, default=ThemeMode.SYSTEM)
    reminder_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    notifications_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    email_notifications: Mapped[bool] = mapped_column(default=True, nullable=False)
    push_notifications: Mapped[bool] = mapped_column(default=True, nullable=False)
    slack_notifications: Mapped[bool] = mapped_column(default=False, nullable=False)
    teams_notifications: Mapped[bool] = mapped_column(default=False, nullable=False)
    privacy_analytics: Mapped[bool] = mapped_column(default=False, nullable=False)
    privacy_ai_coaching: Mapped[bool] = mapped_column(default=False, nullable=False)
    privacy_community: Mapped[bool] = mapped_column(default=False, nullable=False)
    audio_bg_volume: Mapped[float] = mapped_column(default=0.5, nullable=False)
    audio_voice_volume: Mapped[float] = mapped_column(default=0.8, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Profile fields
    age: Mapped[int | None] = mapped_column(nullable=True)
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    mental_health_goals: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
    )
