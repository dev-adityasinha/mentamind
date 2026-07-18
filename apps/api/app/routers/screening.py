import functools
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import forbid_anonymous, get_current_user
from app.models.assessment_bank import AssessmentTemplate
from app.models.test_score import TestScore
from app.models.user import User
from app.schemas.screening import (
    ScreeningDetailResponse,
    ScreeningResultRequest,
    ScreeningResultResponse,
)

try:
    from fastapi_cache.decorator import cache
except ImportError:

    def cache(*args, **kwargs):
        def wrapper(func):
            @functools.wraps(func)
            async def inner(*args, **kwargs):
                return await func(*args, **kwargs)

            return inner

        return wrapper


from app.services.screening_scoring import calculate_screening

router = APIRouter(prefix="/screening", tags=["screening"])


@router.get("/assessments")
@cache(expire=3600)
async def get_assessment_templates(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(AssessmentTemplate)
        .where(AssessmentTemplate.is_active)
        .options(selectinload(AssessmentTemplate.questions))
    )
    templates = result.scalars().all()
    return templates


@router.post("/sessions")
async def start_screening_session(
    current_user: Annotated[User, forbid_anonymous()],
):
    return {"status": "session_started", "user_id": str(current_user.id)}


@router.post("/results", response_model=ScreeningResultResponse)
async def save_screening_result(
    body: ScreeningResultRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    meta: dict = {}
    if body.answers:
        meta["answers"] = body.answers
    if body.max_score:
        meta["max_score"] = body.max_score

    insights = None
    next_steps = None

    if body.answers:
        calc = calculate_screening(body.test_id, body.answers)
        final_score = calc["score"]
        final_severity = calc["severity"]
        insights = calc["insights"]
        next_steps = calc["next_steps"]
        # Persist subscale detail (e.g. burnout EE/DP/PA) for richer reports.
        if calc.get("subscales"):
            meta["subscales"] = calc["subscales"]
    else:
        final_score = body.score
        final_severity = body.severity

    record = TestScore(
        user_id=current_user.id,
        test_id=body.test_id,
        score=final_score,
        severity=final_severity,
        metadata_answers=meta or None,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "test_id": record.test_id,
        "score": record.score,
        "severity": record.severity,
        "created_at": record.created_at,
        "insights": insights,
        "next_steps": next_steps,
    }


@router.get("/history", response_model=list[ScreeningDetailResponse])
async def get_screening_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 90,
):
    cutoff = datetime.now(UTC).date() - timedelta(days=days)
    result = await db.execute(
        select(TestScore)
        .where(
            TestScore.user_id == current_user.id,
            TestScore.created_at >= cutoff,
        )
        .order_by(TestScore.created_at.desc())
    )
    return result.scalars().all()


@router.get("/history/{test_id}", response_model=list[ScreeningDetailResponse])
async def get_screening_history_for_test(
    test_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 365,
):
    cutoff = datetime.now(UTC).date() - timedelta(days=days)
    result = await db.execute(
        select(TestScore)
        .where(
            TestScore.user_id == current_user.id,
            TestScore.test_id == test_id,
            TestScore.created_at >= cutoff,
        )
        .order_by(TestScore.created_at.desc())
    )
    return result.scalars().all()
