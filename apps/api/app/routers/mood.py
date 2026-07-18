from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.mood_log import MoodLog
from app.models.user import User
from app.schemas.mood import (
    EmotionCount,
    MoodAnalyticsBucket,
    MoodAnalyticsResponse,
    MoodCreateRequest,
    MoodResponse,
)
from app.services.encryption import decrypt, encrypt

router = APIRouter(prefix="/mood", tags=["mood"])


def _avg(values: list[int]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


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


@router.get("/analytics", response_model=MoodAnalyticsResponse)
async def get_mood_analytics(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("weekly", pattern="^(weekly|monthly)$"),
    days: int = Query(90, ge=7, le=365),
) -> MoodAnalyticsResponse:
    """Aggregate the user's real mood logs into weekly or monthly buckets.

    Buckets are computed from the actual MoodLog rows in the window — averages
    of mood/energy/stress and entry counts per period, plus the most-frequent
    emotion tags. Nothing is fabricated: periods with no logs are simply absent.
    """
    cutoff = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        select(MoodLog)
        .where(
            MoodLog.user_id == current_user.id,
            MoodLog.logged_at >= cutoff,
        )
        .order_by(MoodLog.logged_at.asc())
    )
    logs = result.scalars().all()

    # Group rows into period buckets keyed by (label, start_date).
    buckets: dict[str, dict] = {}
    for log in logs:
        d = log.logged_at.date()
        if period == "weekly":
            iso_year, iso_week, _ = d.isocalendar()
            label = f"{iso_year}-W{iso_week:02d}"
            # Monday that starts this ISO week.
            start = d - timedelta(days=d.weekday())
        else:  # monthly
            label = f"{d.year}-{d.month:02d}"
            start = d.replace(day=1)

        b = buckets.setdefault(
            label,
            {"start": start, "mood": [], "energy": [], "stress": []},
        )
        b["mood"].append(log.mood_score)
        if log.energy_score is not None:
            b["energy"].append(log.energy_score)
        if log.stress_score is not None:
            b["stress"].append(log.stress_score)

    bucket_models = [
        MoodAnalyticsBucket(
            period=label,
            period_start=data["start"].isoformat(),
            entries=len(data["mood"]),
            avg_mood=_avg(data["mood"]),
            avg_energy=_avg(data["energy"]),
            avg_stress=_avg(data["stress"]),
        )
        for label, data in sorted(buckets.items(), key=lambda kv: kv[1]["start"])
    ]

    all_mood = [log.mood_score for log in logs]
    all_energy = [log.energy_score for log in logs if log.energy_score is not None]
    all_stress = [log.stress_score for log in logs if log.stress_score is not None]

    emotion_counter: Counter[str] = Counter()
    for log in logs:
        emotion_counter.update(log.emotion_tags or [])
    top_emotions = [
        EmotionCount(emotion=name, count=count)
        for name, count in emotion_counter.most_common(5)
    ]

    return MoodAnalyticsResponse(
        period=period,
        range_days=days,
        total_entries=len(logs),
        avg_mood=_avg(all_mood),
        avg_energy=_avg(all_energy),
        avg_stress=_avg(all_stress),
        buckets=bucket_models,
        top_emotions=top_emotions,
    )
