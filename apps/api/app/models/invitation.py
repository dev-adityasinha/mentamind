import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum
from app.models.user import UserRole

_STATUS_VALUES = "('pending', 'accepted', 'revoked')"
_ROLE_VALUES = (
    "('employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student', 'moderator', 'therapist')"
)


class InvitationStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"


class Invitation(Base):
    __tablename__ = "invitations"

    __table_args__ = (
        CheckConstraint(
            f"status IN {_STATUS_VALUES}",
            name="ck_invitations_status",
        ),
        CheckConstraint(
            f"invited_role IN {_ROLE_VALUES}",
            name="ck_invitations_invited_role",
        ),
        Index("ix_invitations_org_id", "org_id"),
        Index("ix_invitations_token_hash", "token_hash", unique=True),
        Index("ix_invitations_org_email", "org_id", "email_hash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    invited_role: Mapped[UserRole] = mapped_column(PgEnum(UserRole), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[InvitationStatus] = mapped_column(
        PgEnum(InvitationStatus), nullable=False, default=InvitationStatus.PENDING
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
