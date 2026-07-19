import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class UserRole(StrEnum):
    ANONYMOUS = "anonymous"
    USER = "user"
    EMPLOYEE = "employee"
    MANAGER = "manager"
    HR_MANAGER = "hr_manager"
    WELLNESS_OFFICER = "wellness_officer"
    ADMIN = "admin"
    COUNSELOR = "counselor"
    STUDENT = "student"
    MODERATOR = "moderator"
    THERAPIST = "therapist"


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        Index("ix_users_org_id", "org_id"),
        Index("ix_users_email_hash", "email_hash", unique=True),
        Index("ix_users_anonymous_session_id", "anonymous_session_id", unique=True),
        Index("ix_users_saml_subject_id", "saml_subject_id", unique=True),
        Index("ix_users_username", "username", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email_hash: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Anonymous"
    )
    # Unique handle chosen by the user. Nullable so pre-existing and anonymous
    # accounts remain valid; uniqueness is enforced per the index below.
    username: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        PgEnum(UserRole), nullable=False, default=UserRole.ANONYMOUS
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    consent_analytics: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    consent_ai_coaching: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    consent_community: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    privacy_consent_version: Mapped[str] = mapped_column(
        String(32), nullable=False, default="v1.0"
    )
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    last_active_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Ghost/anonymous session tracking
    anonymous_session_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )

    # SAML SSO
    saml_subject_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    saml_attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})

    # Encryption key reference (per-user key in KMS)
    encryption_key_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Soft delete for GDPR
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Moderation: ban is a reversible access block, distinct from deleted_at
    # (which is a permanent GDPR soft-delete).
    is_banned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    banned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ban_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
