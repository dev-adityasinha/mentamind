from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import forbid_anonymous, get_current_user
from app.models.test_score import TestScore
from app.models.user import User
from app.schemas.screening import (
    ScreeningDetailResponse,
    ScreeningResultRequest,
    ScreeningResultResponse,
)

router = APIRouter(prefix="/screening", tags=["screening"])


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
    record = TestScore(
        user_id=current_user.id,
        test_id=body.test_id,
        score=body.score,
        severity=body.severity,
        metadata_answers=meta or None,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


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
