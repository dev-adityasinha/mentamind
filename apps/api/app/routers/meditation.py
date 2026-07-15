import functools
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.meditation import (
    MeditationCategory,
    MeditationDifficulty,
    MeditationStats,
    MeditationTrack,
)
from app.models.user import User
from app.schemas.meditation import (
    MeditationHistoryCreate,
    MeditationHistoryResponse,
    MeditationStatsResponse,
    MeditationTrackResponse,
)
from app.services.meditation_tracker import submit_meditation_completion

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

router = APIRouter(prefix="/meditation", tags=["meditation"])


@router.get("/tracks", response_model=list[MeditationTrackResponse])
@cache(expire=3600)
async def list_tracks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: MeditationCategory | None = None,
    difficulty: MeditationDifficulty | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[MeditationTrack]:
    """List all available meditation tracks in the library, with optional filters."""
    stmt = select(MeditationTrack).order_by(MeditationTrack.created_at.desc())

    if category:
        stmt = stmt.where(MeditationTrack.category == category)
    if difficulty:
        stmt = stmt.where(MeditationTrack.difficulty == difficulty)

    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/tracks/{track_id}", response_model=MeditationTrackResponse)
async def get_track(
    track_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationTrack:
    """Get details of a specific meditation track."""
    track = await db.get(MeditationTrack, track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )
    return track


@router.post(
    "/history",
    response_model=MeditationHistoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def complete_meditation(
    body: MeditationHistoryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Submit a completed meditation session to update user progress and streaks."""
    # Ensure track exists
    track = await db.get(MeditationTrack, body.track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )

    history = await submit_meditation_completion(
        db=db,
        user_id=current_user.id,
        track_id=track.id,
        duration_minutes=body.duration_minutes,
    )

    await db.commit()
    await db.refresh(history)

    # Needs explicit loading or returned as dict for Pydantic to serialize
    return {
        "id": history.id,
        "user_id": history.user_id,
        "track_id": history.track_id,
        "duration_minutes": history.duration_minutes,
        "completed_at": history.completed_at,
        "track": track,
    }


@router.get("/stats", response_model=MeditationStatsResponse)
async def get_my_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationStats:
    """Get the current user's aggregated meditation stats (streaks, total minutes)."""
    result = await db.execute(
        select(MeditationStats).where(MeditationStats.user_id == current_user.id)
    )
    stats = result.scalar_one_or_none()

    if not stats:
        # Return default 0s if they haven't meditated yet
        return MeditationStats(
            user_id=current_user.id,
            total_minutes=0,
            total_sessions=0,
            current_streak=0,
            longest_streak=0,
            last_meditated_at=None,
        )
    return stats
