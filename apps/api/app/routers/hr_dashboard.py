from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.mood_log import MoodLog
from app.models.user import User, UserRole
from app.models.wellness_score import WellnessScore

router = APIRouter(prefix="/admin/hr", tags=["hr"])


@router.get("/org-wellness")
async def get_org_wellness(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
    days: int = 30,
) -> dict:
    cutoff = datetime.now(UTC).date() - timedelta(days=days)

    result = await db.execute(
        select(
            WellnessScore.score_date,
            func.avg(WellnessScore.composite_score).label("avg_composite"),
            func.avg(WellnessScore.mood_component).label("avg_mood"),
            func.avg(WellnessScore.stress_component).label("avg_stress"),
            func.avg(WellnessScore.burnout_risk_score).label("avg_burnout"),
            func.count(WellnessScore.id).label("participants"),
        )
        .where(
            WellnessScore.org_id == current_user.org_id,
            WellnessScore.score_date >= cutoff,
        )
        .group_by(WellnessScore.score_date)
        .order_by(WellnessScore.score_date)
    )
    rows = result.all()

    return {
        "org_id": str(current_user.org_id),
        "days": days,
        "trend": [
            {
                "date": r.score_date.isoformat(),
                "avg_composite": (
                    round(float(r.avg_composite), 1) if r.avg_composite else None
                ),
                "avg_mood": round(float(r.avg_mood), 1) if r.avg_mood else None,
                "avg_stress": round(float(r.avg_stress), 1) if r.avg_stress else None,
                "avg_burnout": (
                    round(float(r.avg_burnout), 1) if r.avg_burnout else None
                ),
                "participants": r.participants,
            }
            for r in rows
        ],
    }


@router.get("/participation")
async def get_participation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
) -> dict:
    total = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == current_user.org_id,
            User.is_anonymous.is_(False),
            User.deleted_at.is_(None),
        )
    )
    total_users = total.scalar() or 0

    # Start of the current month in UTC. MoodLog.logged_at is timezone-aware
    # (DateTime(timezone=True)), so the boundary must be tz-aware too — comparing
    # it against a naive date() coerces to server-local midnight and can miscount
    # around month boundaries. Use UTC to match the rest of the codebase.
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    active = await db.execute(
        select(func.count(func.distinct(MoodLog.user_id))).where(
            MoodLog.org_id == current_user.org_id,
            MoodLog.logged_at >= month_start,
        )
    )
    active_users = active.scalar() or 0

    return {
        "org_id": str(current_user.org_id),
        "total_users": total_users,
        "active_this_month": active_users,
        "participation_rate": (
            round(active_users / total_users * 100, 1) if total_users else 0.0
        ),
    }


@router.get("/dept-heatmap")
async def get_dept_heatmap(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
    days: int = 30,
) -> dict:
    cutoff = datetime.now(UTC).date() - timedelta(days=days)

    result = await db.execute(
        select(
            WellnessScore.score_date,
            func.avg(WellnessScore.composite_score).label("avg_score"),
            func.count(WellnessScore.id).label("count"),
        )
        .where(
            WellnessScore.org_id == current_user.org_id,
            WellnessScore.score_date >= cutoff,
        )
        .group_by(WellnessScore.score_date)
        .order_by(WellnessScore.score_date)
    )
    rows = result.all()

    return {
        "org_id": str(current_user.org_id),
        "heatmap": [
            {
                "date": r.score_date.isoformat(),
                "avg_score": round(float(r.avg_score), 1) if r.avg_score else None,
                "responses": r.count,
            }
            for r in rows
        ],
    }
