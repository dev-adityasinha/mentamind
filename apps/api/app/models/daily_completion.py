import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DailyCompletion(Base):
    __tablename__ = "daily_completions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_date: Mapped[date] = mapped_column(
        Date, default=date.today, nullable=False
    )
    meditation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    meditation_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reflection: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "day", "completion_date", name="uq_user_day_date"),
    )
