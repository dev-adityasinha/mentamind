import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum

CONSENT_DOCUMENT_VERSION = "v1.0"


class ConsentType(StrEnum):
    ANALYTICS = "analytics"
    AI_COACHING = "ai_coaching"


class ConsentAction(StrEnum):
    GRANTED = "granted"
    WITHDRAWN = "withdrawn"


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    __table_args__ = (
        CheckConstraint(
            "consent_type IN ('analytics', 'ai_coaching')",
            name="ck_consent_records_consent_type",
        ),
        CheckConstraint(
            "action IN ('granted', 'withdrawn')",
            name="ck_consent_records_action",
        ),
        Index("ix_consent_records_user_id", "user_id"),
        Index("ix_consent_records_org_id", "org_id"),
        Index("ix_consent_records_user_type", "user_id", "consent_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        PgEnum(ConsentType), nullable=False
    )
    action: Mapped[ConsentAction] = mapped_column(PgEnum(ConsentAction), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
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
