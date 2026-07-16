import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class RiskLevel(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    ELEVATED = "elevated"
    HIGH = "high"


class TriggerSource(StrEnum):
    CHECKIN = "checkin"
    COACH = "coach"
    JOURNAL = "journal"
    FORUM = "forum"
    MANUAL = "manual"


class PsychologistSummary(Base):
    __tablename__ = "psychologist_summaries"

    __table_args__ = (
        Index("ix_psychologist_summaries_user_id", "user_id"),
        Index("ix_psychologist_summaries_session_id", "session_id"),
        Index("ix_psychologist_summaries_generated_at", "generated_at"),
        Index("ix_psychologist_summaries_risk_level", "risk_level"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trigger_source: Mapped[TriggerSource] = mapped_column(
        PgEnum(TriggerSource), nullable=False, default=TriggerSource.CHECKIN
    )
    summary: Mapped[str] = mapped_column(String, nullable=False)
    recommendations: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(PgEnum(RiskLevel), nullable=False)
    analysis_count: Mapped[int] = mapped_column(nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
