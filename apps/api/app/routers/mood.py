from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.mood_log import MoodLog
from app.models.user import User
from app.schemas.mood import MoodCreateRequest, MoodResponse
from app.services.encryption import decrypt, encrypt

router = APIRouter(prefix="/mood", tags=["mood"])


@router.post("", response_model=MoodResponse, status_code=status.HTTP_201_CREATED)
async def create_mood_log(
    request: MoodCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MoodResponse:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(MoodLog)
        .where(
            MoodLog.user_id == current_user.id,
            MoodLog.logged_at >= today_start,
        )
        .order_by(MoodLog.logged_at.desc())
        .limit(1)
    )
    existing_log = result.scalar_one_or_none()

    note_encrypted = None
    if request.note:
        note_encrypted = encrypt(request.note, current_user.id.bytes)

    if existing_log:
        existing_log.mood_score = request.mood_score
        existing_log.energy_score = request.energy_score
        existing_log.stress_score = request.stress_score
        existing_log.emotion_tags = request.emotion_tags
        existing_log.context_tag = request.context_tag
        existing_log.context_encrypted = note_encrypted
        existing_log.input_method = request.input_method
        existing_log.logged_at = now
        log = existing_log
    else:
        log = MoodLog(
            user_id=current_user.id,
            org_id=current_user.org_id,
            mood_score=request.mood_score,
            energy_score=request.energy_score,
            stress_score=request.stress_score,
            emotion_tags=request.emotion_tags,
            context_tag=request.context_tag,
            context_encrypted=note_encrypted,
            input_method=request.input_method,
            logged_at=now,
        )
        db.add(log)

    await db.commit()
    await db.refresh(log)

    from app.services.wellness import compute_and_save_wellness_score

    await compute_and_save_wellness_score(db, current_user, now)

    return MoodResponse(
        id=log.id,
        mood_score=log.mood_score,
        energy_score=log.energy_score,
        stress_score=log.stress_score,
        emotion_tags=log.emotion_tags,
        context_tag=log.context_tag,
        note=request.note,
        input_method=log.input_method,
        logged_at=log.logged_at,
        created_at=log.created_at,
    )


@router.get("/history", response_model=list[MoodResponse])
async def get_mood_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
) -> list[MoodResponse]:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        select(MoodLog)
        .where(
            MoodLog.user_id == current_user.id,
            MoodLog.logged_at >= cutoff,
        )
        .order_by(MoodLog.logged_at.desc())
    )
    logs = result.scalars().all()

    responses = []
    for log in logs:
        note = None
        if log.context_encrypted:
            try:
                note = decrypt(log.context_encrypted, current_user.id.bytes)
            except Exception:
                note = "[Encrypted Content]"

        responses.append(
            MoodResponse(
                id=log.id,
                mood_score=log.mood_score,
                energy_score=log.energy_score,
                stress_score=log.stress_score,
                emotion_tags=log.emotion_tags,
                context_tag=log.context_tag,
                note=note,
                input_method=log.input_method,
                logged_at=log.logged_at,
                created_at=log.created_at,
            )
        )

    return responses
