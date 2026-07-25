"""Mindful Architecture — 30-day guided meditation journey.

Endpoints for the meditation module ported from Mindful-Architecture. All are
authenticated with Mentamind's standard auth (get_current_user) so a logged-in
user needs no separate login. Purely additive — the existing /meditation router
(track library) is untouched.
"""

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.curriculum_day import CurriculumBlock, CurriculumDay
from app.models.daily_completion import DailyCompletion
from app.models.user import User
from app.schemas.mindful import (
    CurriculumBlockResponse,
    CurriculumDayResponse,
    DailyCompletionResponse,
    DailyCompletionUpdate,
    JourneyBlockProgress,
    JourneyResponse,
)

router = APIRouter(prefix="/mindful", tags=["mindful"])

TOTAL_DAYS = 30


# ---------------------------------------------------------------------------
# Curriculum content (global, read-only)
# ---------------------------------------------------------------------------
@router.get("/curriculum", response_model=list[CurriculumDayResponse])
async def list_curriculum(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CurriculumDay]:
    """Return all 30 days of curriculum content, ordered by day."""
    result = await db.execute(select(CurriculumDay).order_by(CurriculumDay.day))
    return list(result.scalars().all())


@router.get("/curriculum/blocks", response_model=list[CurriculumBlockResponse])
async def list_blocks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CurriculumBlock]:
    """Return the three journey blocks (Foundation / Depth / Integration)."""
    result = await db.execute(select(CurriculumBlock).order_by(CurriculumBlock.block))
    return list(result.scalars().all())


@router.get("/curriculum/{day}", response_model=CurriculumDayResponse)
async def get_curriculum_day(
    day: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CurriculumDay:
    """Return the content for a single day (1-30)."""
    result = await db.execute(select(CurriculumDay).where(CurriculumDay.day == day))
    content = result.scalar_one_or_none()
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Day not found"
        )
    return content


# ---------------------------------------------------------------------------
# Daily completions (per user)
# ---------------------------------------------------------------------------
async def _latest_completion_for_day(
    db: AsyncSession, user_id, day: int
) -> DailyCompletion | None:
    """Most recent completion row for a user+day (any date)."""
    result = await db.execute(
        select(DailyCompletion)
        .where(
            DailyCompletion.user_id == user_id,
            DailyCompletion.day == day,
        )
        .order_by(DailyCompletion.completion_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/completions", response_model=list[DailyCompletionResponse])
async def list_completions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DailyCompletion]:
    """All of the current user's daily-completion rows."""
    result = await db.execute(
        select(DailyCompletion)
        .where(DailyCompletion.user_id == current_user.id)
        .order_by(DailyCompletion.day)
    )
    return list(result.scalars().all())


@router.get("/completions/{day}", response_model=DailyCompletionResponse | None)
async def get_completion(
    day: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DailyCompletion | None:
    """The current user's completion row for a given day, or null."""
    return await _latest_completion_for_day(db, current_user.id, day)


@router.post("/completions", response_model=DailyCompletionResponse)
async def mark_completion(
    body: DailyCompletionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DailyCompletion:
    """Mark parts of a day complete (meditation / task / reflection).

    Upserts today's completion row for the given day. Only the flags present in
    the request body are changed; once set true a flag is never cleared here.
    """
    today = date.today()
    result = await db.execute(
        select(DailyCompletion).where(
            DailyCompletion.user_id == current_user.id,
            DailyCompletion.day == body.day,
            DailyCompletion.completion_date == today,
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        row = DailyCompletion(
            user_id=current_user.id,
            day=body.day,
            completion_date=today,
        )
        db.add(row)

    if body.meditation:
        row.meditation = True
    if body.meditation_duration is not None:
        row.meditation_duration = body.meditation_duration
    if body.task:
        row.task = True
    if body.reflection:
        row.reflection = True

    await db.commit()
    await db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Journey / progress
# ---------------------------------------------------------------------------
@router.get("/journey", response_model=JourneyResponse)
async def get_journey(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JourneyResponse:
    """Derive the user's journey state from their daily completions.

    A day counts as "completed" when its meditation is done (the core action).
    current_day = first not-yet-completed day (capped at TOTAL_DAYS); streak =
    consecutive completed days from day 1.
    """
    # Completed days = days whose latest row has meditation done.
    comp_result = await db.execute(
        select(
            DailyCompletion.day, DailyCompletion.meditation, DailyCompletion.created_at
        )
        .where(DailyCompletion.user_id == current_user.id)
        .order_by(DailyCompletion.day)
    )
    completed_by_day: dict[int, bool] = {}
    last_completed_at: datetime | None = None
    for day, meditation, created_at in comp_result.all():
        if meditation:
            completed_by_day[day] = True
            if last_completed_at is None or (
                created_at is not None and created_at > last_completed_at
            ):
                last_completed_at = created_at

    completed_days = len(completed_by_day)

    # current_day = lowest day (1..TOTAL_DAYS) not yet completed.
    current_day = TOTAL_DAYS
    for d in range(1, TOTAL_DAYS + 1):
        if not completed_by_day.get(d):
            current_day = d
            break

    # streak = consecutive completed days starting from day 1.
    streak = 0
    for d in range(1, TOTAL_DAYS + 1):
        if completed_by_day.get(d):
            streak += 1
        else:
            break

    # Per-block progress.
    block_result = await db.execute(
        select(CurriculumDay.block, CurriculumDay.day).order_by(CurriculumDay.day)
    )
    block_days: dict[int, list[int]] = {}
    for block, day in block_result.all():
        block_days.setdefault(block, []).append(day)

    name_result = await db.execute(select(CurriculumBlock.block, CurriculumBlock.name))
    block_names = {b: n for b, n in name_result.all()}

    blocks = [
        JourneyBlockProgress(
            block=b,
            name=block_names.get(b, f"Block {b}"),
            total_days=len(days),
            completed_days=sum(1 for d in days if completed_by_day.get(d)),
        )
        for b, days in sorted(block_days.items())
    ]

    return JourneyResponse(
        current_day=current_day,
        total_days=TOTAL_DAYS,
        streak=streak,
        completed_days=completed_days,
        blocks=blocks,
        last_completed_at=last_completed_at,
    )
