import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum, TextArrayType

ALLOWED_EMOTION_TAGS: frozenset[str] = frozenset(
    {
        "calm",
        "happy",
        "anxious",
        "stressed",
        "sad",
        "frustrated",
        "grateful",
        "excited",
        "tired",
        "overwhelmed",
        "motivated",
        "lonely",
        "proud",
        "irritable",
        "hopeful",
    }
)


def validate_emotion_tags(tags: list[str]) -> list[str]:
    """Raise ValueError if any tag is not in the allowed set."""
    invalid = [t for t in tags if t not in ALLOWED_EMOTION_TAGS]
    if invalid:
        raise ValueError(
            f"Invalid emotion tag(s): {invalid}. "
            f"Allowed: {sorted(ALLOWED_EMOTION_TAGS)}"
        )
    return tags


class InputMethod(StrEnum):
    TAP = "tap"
    VOICE = "voice"
    TEXT = "text"


class MoodLog(Base):
    __tablename__ = "mood_logs"

    __table_args__ = (
        CheckConstraint(
            "mood_score >= 1 AND mood_score <= 5", name="ck_mood_logs_mood_score"
        ),
        CheckConstraint(
            "energy_score >= 1 AND energy_score <= 5", name="ck_mood_logs_energy_score"
        ),
        CheckConstraint(
            "stress_score >= 1 AND stress_score <= 5", name="ck_mood_logs_stress_score"
        ),
        Index("ix_mood_logs_user_id", "user_id"),
        Index("ix_mood_logs_org_id", "org_id"),
        Index("ix_mood_logs_user_logged_at", "user_id", "logged_at"),
        Index("ix_mood_logs_session_id", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    mood_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    energy_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    stress_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    emotion_tags: Mapped[list[str]] = mapped_column(TextArrayType, nullable=False)
    context_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    context_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    input_method: Mapped[InputMethod] = mapped_column(
        PgEnum(InputMethod), nullable=False
    )

    # Voice input support
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_duration_seconds: Mapped[int | None] = mapped_column(nullable=True)

    # AI sentiment analysis (-1.0 to 1.0)
    ai_sentiment_score: Mapped[float | None] = mapped_column(nullable=True)
    ai_emotion_tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=[]
    )

    # Clinical screening scores (PHQ-4, GAD-7, etc.)
    clinical_scores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Ghost session tracking
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
