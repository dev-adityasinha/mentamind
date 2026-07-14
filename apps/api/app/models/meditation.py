import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MeditationCategory(enum.StrEnum):
    GUIDED = "guided"
    SLEEP = "sleep"
    RELAXATION = "relaxation"
    FOCUS = "focus"
    STRESS = "stress"
    ANXIETY = "anxiety"


class MeditationDifficulty(enum.StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class MeditationTrack(Base):
    """The static library of meditation sessions"""

    __tablename__ = "meditation_tracks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    category: Mapped[MeditationCategory] = mapped_column(
        Enum(MeditationCategory, name="meditation_category_enum", native_enum=False),
        nullable=False,
    )
    difficulty: Mapped[MeditationDifficulty] = mapped_column(
        Enum(
            MeditationDifficulty, name="meditation_difficulty_enum", native_enum=False
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )


class MeditationHistory(Base):
    """Tracks each individual completion of a meditation session by a user"""

    __tablename__ = "meditation_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meditation_tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Allows partial completions (e.g., they listened for 5 mins of a 10 min track)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    # Relationships
    track: Mapped[MeditationTrack] = relationship("MeditationTrack")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore


class MeditationStats(Base):
    """
    A materialized view-like table for fast querying of a user's progress & streaks
    """

    __tablename__ = "meditation_stats"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    total_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    last_meditated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore
