from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.db_types import PgEnum

if TYPE_CHECKING:
    from app.models.message import ChatMessage
    from app.models.user import User


class ChatSessionStatus(StrEnum):
    WAITING = "waiting"
    ACTIVE = "active"
    ENDED = "ended"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    participant_1_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    participant_2_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    status: Mapped[ChatSessionStatus] = mapped_column(
        PgEnum(ChatSessionStatus),
        nullable=False,
        default=ChatSessionStatus.WAITING,
        index=True,
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    participant_1: Mapped[User] = relationship("User", foreign_keys=[participant_1_id])
    participant_2: Mapped[User | None] = relationship(
        "User", foreign_keys=[participant_2_id]
    )
    messages: Mapped[list[ChatMessage]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )
