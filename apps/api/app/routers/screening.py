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


def calculate_screening(test_id: str, answers: list[int]) -> dict:
    score = sum(answers)
    severity = "Minimal"
    insights = ""
    next_steps = ""

    if test_id.lower() == "phq-9":
        if score >= 20:
            severity = "Severe"
            insights = "Your score indicates severe symptoms of depression."
            next_steps = "We strongly recommend seeking professional clinical support."
        elif score >= 15:
            severity = "Moderately Severe"
            insights = "Your score indicates moderately severe symptoms of depression."
            next_steps = "Consider reaching out to a therapist or using our AI coach for guided reflection."
        elif score >= 10:
            severity = "Moderate"
            insights = "Your score indicates moderate symptoms of depression."
            next_steps = "Regular check-ins and talking to the AI coach can help manage these feelings."
        elif score >= 5:
            severity = "Mild"
            insights = "Your score indicates mild symptoms of depression."
            next_steps = "Try our mindfulness exercises and daily journaling."
        else:
            severity = "Minimal"
            insights = "Your score indicates minimal or no symptoms of depression."
            next_steps = "Keep up the good habits!"
    elif test_id.lower() == "gad-7":
        if score >= 15:
            severity = "Severe"
            insights = "Your score indicates severe anxiety symptoms."
            next_steps = "We strongly recommend seeking professional clinical support."
        elif score >= 10:
            severity = "Moderate"
            insights = "Your score indicates moderate anxiety symptoms."
            next_steps = "Consider reaching out to a therapist or trying our guided meditations for anxiety."
        elif score >= 5:
            severity = "Mild"
            insights = "Your score indicates mild anxiety symptoms."
            next_steps = "Try our deep breathing exercises and stress-relief resources."
        else:
            severity = "Minimal"
            insights = "Your score indicates minimal anxiety symptoms."
            next_steps = "Keep up the good habits!"
    else:
        severity = "Unknown"
        insights = "Assessment completed."
        next_steps = "Review your results."

    return {
        "score": score,
        "severity": severity,
        "insights": insights,
        "next_steps": next_steps,
    }


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

    insights = None
    next_steps = None

    if body.answers:
        calc = calculate_screening(body.test_id, body.answers)
        final_score = calc["score"]
        final_severity = calc["severity"]
        insights = calc["insights"]
        next_steps = calc["next_steps"]
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
