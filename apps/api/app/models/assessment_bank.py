import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AssessmentTemplate(Base):
    __tablename__ = "assessment_templates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    short_id: Mapped[str] = mapped_column(
        String(32), unique=True, index=True
    )  # e.g. "phq-9"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(64), nullable=True
    )  # e.g. "Depression", "Anxiety"
    color: Mapped[str] = mapped_column(String(32), nullable=True)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    scoring_rules: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=[])

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    questions: Mapped[list["AssessmentQuestion"]] = relationship(
        "AssessmentQuestion",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="AssessmentQuestion.order",
    )


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    __table_args__ = (Index("ix_assessment_questions_template_id", "template_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_templates.id", ondelete="CASCADE"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    options: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=[])

    template: Mapped["AssessmentTemplate"] = relationship(
        "AssessmentTemplate", back_populates="questions"
    )
