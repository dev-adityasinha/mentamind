import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class AppointmentStatus(StrEnum):
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class SessionType(StrEnum):
    INDIVIDUAL = "individual"
    GROUP = "group"
    CRISIS = "crisis"
    FOLLOW_UP = "follow_up"


class Appointment(Base):
    __tablename__ = "appointments"

    __table_args__ = (
        Index("ix_appointments_user_id", "user_id"),
        Index("ix_appointments_org_id", "org_id"),
        Index("ix_appointments_counselor_id", "counselor_id"),
        Index("ix_appointments_scheduled_at", "scheduled_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    counselor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        PgEnum(AppointmentStatus), nullable=False
    )
    session_type: Mapped[SessionType] = mapped_column(
        PgEnum(SessionType), nullable=False
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
