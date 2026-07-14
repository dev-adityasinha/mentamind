import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class CrisisType(StrEnum):
    SUICIDE = "suicide"
    SELF_HARM = "self_harm"
    CRISIS = "crisis"


class AiCoachSession(Base):
    __tablename__ = "ai_coach_sessions"

    __table_args__ = (
        Index("ix_ai_coach_sessions_user_id", "user_id"),
        Index("ix_ai_coach_sessions_session_id", "session_id"),
        Index("ix_ai_coach_sessions_user_started", "user_id", "started_at"),
        Index("ix_ai_coach_sessions_crisis", "crisis_detected"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    crisis_detected: Mapped[bool] = mapped_column(default=False, nullable=False)
    crisis_type: Mapped[CrisisType | None] = mapped_column(
        PgEnum(CrisisType), nullable=True
    )
    escalated: Mapped[bool] = mapped_column(default=False, nullable=False)
    escalated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    summary: Mapped[str | None] = mapped_column(nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})


class AiCoachMessage(Base):
    __tablename__ = "ai_coach_messages"

    __table_args__ = (
        Index("ix_ai_coach_messages_session_id", "session_id"),
        Index("ix_ai_coach_messages_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_coach_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content_encrypted: Mapped[str] = mapped_column(nullable=False)
    content_nonce: Mapped[str] = mapped_column(String(32), nullable=False)
    sentiment_score: Mapped[float | None] = mapped_column(nullable=True)
    emotion_tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=[])
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
