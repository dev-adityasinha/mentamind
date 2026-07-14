import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class JournalEntryType(StrEnum):
    TEXT = "text"
    VOICE = "voice"
    GRATITUDE = "gratitude"
    AI_REFLECTION = "ai_reflection"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    __table_args__ = (
        Index("ix_journal_entries_user_id", "user_id"),
        Index("ix_journal_entries_user_created", "user_id", "created_at"),
        Index("ix_journal_entries_type", "entry_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    entry_type: Mapped[JournalEntryType] = mapped_column(
        PgEnum(JournalEntryType), nullable=False, default=JournalEntryType.TEXT
    )
    content_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    content_nonce: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    mood_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    emotion_tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=[]
    )
    ai_reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(default=0, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
    )
