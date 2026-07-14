"""Data contract tests: PgEnum round-trip, tenant isolation, emotion tag validation."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mood_log import (
    ALLOWED_EMOTION_TAGS,
    InputMethod,
    MoodLog,
    validate_emotion_tags,
)
from app.models.organization import DataResidencyRegion, Organization
from app.models.user import UserRole
from app.models.wellness_score import BurnoutRiskLevel, WellnessScore
from tests.conftest import create_user

# ---------------------------------------------------------------------------
# PgEnum round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pgenum_input_method_round_trip(db_session: AsyncSession) -> None:
    """InputMethod written as a Python enum member must be read back as the same."""
    org = Organization(
        name=f"RoundTrip-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.EU,
    )
    db_session.add(org)
    await db_session.flush()

    user, _ = await create_user(db_session, org.id, UserRole.EMPLOYEE, "rt")

    log = MoodLog(
        user_id=user.id,
        org_id=org.id,
        mood_score=4,
        emotion_tags=["calm"],
        input_method=InputMethod.VOICE,
        logged_at=datetime.now(UTC),
    )
    db_session.add(log)
    await db_session.flush()

    await db_session.refresh(log)
    assert log.input_method is InputMethod.VOICE
    assert isinstance(log.input_method, InputMethod)


@pytest.mark.asyncio
async def test_pgenum_burnout_risk_level_round_trip(db_session: AsyncSession) -> None:
    """BurnoutRiskLevel written as enum member must be read back as the same member."""
    org = Organization(
        name=f"BurnoutRT-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.IN,
    )
    db_session.add(org)
    await db_session.flush()

    user, _ = await create_user(db_session, org.id, UserRole.EMPLOYEE, "brt")

    score = WellnessScore(
        user_id=user.id,
        org_id=org.id,
        score_date=datetime.now(UTC).date(),
        model_version="v1.0.0",
        composite_score=35,
        mood_component=30,
        sleep_component=40,
        stress_component=70,
        energy_component=30,
        activity_component=50,
        journaling_component=0,
        burnout_risk_score=72,
        burnout_risk_level=BurnoutRiskLevel.RED,
    )
    db_session.add(score)
    await db_session.flush()

    await db_session.refresh(score)
    assert score.burnout_risk_level is BurnoutRiskLevel.RED
    assert isinstance(score.burnout_risk_level, BurnoutRiskLevel)


# ---------------------------------------------------------------------------
# Tenant isolation: mood_logs must not leak across org boundaries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mood_log_org_isolation(
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    """A MoodLog created for org_a must not be retrievable under org_b's scope."""
    from sqlalchemy import select

    user_a, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "iso-a")

    log = MoodLog(
        user_id=user_a.id,
        org_id=org_a.id,
        mood_score=3,
        emotion_tags=["calm"],
        input_method=InputMethod.TAP,
        logged_at=datetime.now(UTC),
    )
    db_session.add(log)
    await db_session.flush()

    result = await db_session.execute(
        select(MoodLog).where(
            MoodLog.id == log.id,
            MoodLog.org_id == org_b.id,
        )
    )
    assert (
        result.scalar_one_or_none() is None
    ), "MoodLog for org_a must not be visible under org_b's org_id filter"


# ---------------------------------------------------------------------------
# emotion_tags validation
# ---------------------------------------------------------------------------


def test_validate_emotion_tags_valid() -> None:
    tags = ["calm", "happy", "grateful"]
    assert validate_emotion_tags(tags) == tags


def test_validate_emotion_tags_all_allowed() -> None:
    all_tags = list(ALLOWED_EMOTION_TAGS)
    assert validate_emotion_tags(all_tags) == all_tags


def test_validate_emotion_tags_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="Invalid emotion tag"):
        validate_emotion_tags(["calm", "euphoric"])


def test_validate_emotion_tags_rejects_empty_string() -> None:
    with pytest.raises(ValueError, match="Invalid emotion tag"):
        validate_emotion_tags([""])


def test_validate_emotion_tags_empty_list_is_valid() -> None:
    assert validate_emotion_tags([]) == []
