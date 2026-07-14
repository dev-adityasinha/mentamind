from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mood_log import MoodLog
from app.models.user import User
from app.models.wellness_score import BurnoutRiskLevel, WellnessScore

WEIGHTS = {
    "mood": 0.25,
    "sleep": 0.20,
    "stress": 0.20,
    "energy": 0.15,
    "activity": 0.10,
    "journaling": 0.10,
}

MODEL_VERSION = "v1.0"


async def compute_and_save_wellness_score(
    db: AsyncSession, user: User, score_date: datetime
) -> WellnessScore:
    """Recomputes the daily wellness score for a user."""
    day_start = score_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = score_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    moods = await db.execute(
        select(MoodLog).where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= day_start,
            MoodLog.logged_at <= day_end,
        )
    )
    mood_list = moods.scalars().all()

    components = {}
    if len(mood_list) > 0:
        avg_mood = sum(m.mood_score for m in mood_list) / len(mood_list)
        components["mood"] = int((avg_mood - 1) * 25)

    composite_score = 0
    total_weight = sum(WEIGHTS[k] for k in components.keys())
    if total_weight > 0:
        for k in components:
            composite_score += int(components[k] * (WEIGHTS[k] / total_weight))

    burnout_score = None
    burnout_level = None
    if "mood" in components:
        burnout_score = 100 - components["mood"]
        if burnout_score > 75:
            burnout_level = BurnoutRiskLevel.RED
        elif burnout_score > 40:
            burnout_level = BurnoutRiskLevel.AMBER
        else:
            burnout_level = BurnoutRiskLevel.GREEN

    existing = await db.execute(
        select(WellnessScore).where(
            WellnessScore.user_id == user.id,
            WellnessScore.score_date == day_start.date(),
        )
    )
    score_record = existing.scalar_one_or_none()

    if score_record:
        score_record.composite_score = composite_score
        score_record.mood_component = components.get("mood", 0)
        score_record.sleep_component = components.get("sleep", 0)
        score_record.stress_component = components.get("stress", 0)
        score_record.energy_component = components.get("energy", 0)
        score_record.activity_component = components.get("activity", 0)
        score_record.journaling_component = components.get("journaling", 0)
        score_record.burnout_risk_score = burnout_score
        score_record.burnout_risk_level = burnout_level
        score_record.model_version = MODEL_VERSION
    else:
        score_record = WellnessScore(
            user_id=user.id,
            org_id=user.org_id,
            score_date=day_start.date(),
            composite_score=composite_score,
            mood_component=components.get("mood", 0),
            sleep_component=components.get("sleep", 0),
            stress_component=components.get("stress", 0),
            energy_component=components.get("energy", 0),
            activity_component=components.get("activity", 0),
            journaling_component=components.get("journaling", 0),
            burnout_risk_score=burnout_score,
            burnout_risk_level=burnout_level,
            model_version=MODEL_VERSION,
        )
        db.add(score_record)

    await db.commit()
    await db.refresh(score_record)
    return score_record
