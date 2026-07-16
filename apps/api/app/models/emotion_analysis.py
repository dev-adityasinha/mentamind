import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class IntensityLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRISIS = "crisis"


class EmotionSource(StrEnum):
    CHECKIN = "checkin"
    COACH = "coach"
    JOURNAL = "journal"
    FORUM = "forum"


class EmotionAnalysis(Base):
    __tablename__ = "emotion_analyses"

    __table_args__ = (
        Index("ix_emotion_ix_emotion_analyses_user_id", "user_id"),
        Index("ix_emotion_analyses_session_id", "session_id"),
        Index("ix_emotion_analyses_source", "source"),
        Index("ix_emotion_analyses_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[EmotionSource] = mapped_column(
        PgEnum(EmotionSource), nullable=False, default=EmotionSource.CHECKIN
    )
    primary_emotions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    secondary_emotions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    themes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    possible_core_issue: Mapped[str] = mapped_column(String, nullable=False)
    intensity: Mapped[IntensityLevel] = mapped_column(
        PgEnum(IntensityLevel), nullable=False
    )
    message_count: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
