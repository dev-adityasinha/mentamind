import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class BurnoutRiskLevel(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


def _component_check(col: str) -> CheckConstraint:
    return CheckConstraint(
        f"{col} >= 0 AND {col} <= 100",
        name=f"ck_wellness_scores_{col}",
    )


class WellnessScore(Base):
    __tablename__ = "wellness_scores"

    __table_args__ = (
        UniqueConstraint("user_id", "score_date", name="uq_wellness_scores_user_date"),
        CheckConstraint(
            "composite_score >= 0 AND composite_score <= 100",
            name="ck_wellness_scores_composite",
        ),
        CheckConstraint(
            "burnout_risk_score >= 0 AND burnout_risk_score <= 100",
            name="ck_wellness_scores_burnout_risk",
        ),
        _component_check("mood_component"),
        _component_check("sleep_component"),
        _component_check("stress_component"),
        _component_check("energy_component"),
        _component_check("activity_component"),
        _component_check("journaling_component"),
        Index("ix_wellness_scores_user_id", "user_id"),
        Index("ix_wellness_scores_org_id", "org_id"),
        Index("ix_wellness_scores_score_date", "score_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    composite_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mood_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    sleep_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    stress_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    energy_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    activity_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    journaling_component: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    burnout_risk_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    burnout_risk_level: Mapped[BurnoutRiskLevel | None] = mapped_column(
        PgEnum(BurnoutRiskLevel), nullable=True
    )
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    computation_version: Mapped[str] = mapped_column(
        String(32), nullable=False, default="v1.0"
    )

    # Anonymized aggregate for HR dashboards (differential privacy applied)
    anonymized_org_score: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
