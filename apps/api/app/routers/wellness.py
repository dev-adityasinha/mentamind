from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.wellness_score import WellnessScore
from app.schemas.wellness import WellnessScoreResponse

router = APIRouter(prefix="/wellness", tags=["wellness"])


@router.get("/score", response_model=list[WellnessScoreResponse])
async def get_wellness_scores(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
) -> list[WellnessScoreResponse]:
    cutoff = datetime.now(UTC).date() - timedelta(days=days)

    result = await db.execute(
        select(WellnessScore)
        .where(
            WellnessScore.user_id == current_user.id,
            WellnessScore.score_date >= cutoff,
        )
        .order_by(WellnessScore.score_date.desc())
    )

    return result.scalars().all()
