import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meditation import MeditationHistory, MeditationStats


async def submit_meditation_completion(
    db: AsyncSession,
    user_id: uuid.UUID,
    track_id: uuid.UUID,
    duration_minutes: int,
) -> MeditationHistory:
    """
    Records a completed meditation track for a user and securely updates their
    global stats.
    Calculates daily streak logic.
    """
    now = datetime.now(UTC)

    # 1. Create the history record
    history = MeditationHistory(
        user_id=user_id,
        track_id=track_id,
        duration_minutes=duration_minutes,
        completed_at=now,
    )
    db.add(history)

    # 2. Fetch or create the stats record
    result = await db.execute(
        select(MeditationStats).where(MeditationStats.user_id == user_id)
    )
    stats = result.scalar_one_or_none()

    if not stats:
        stats = MeditationStats(
            user_id=user_id,
            total_minutes=0,
            total_sessions=0,
            current_streak=0,
            longest_streak=0
        )
        db.add(stats)

    # 3. Update basic counts
    stats.total_minutes += duration_minutes
    stats.total_sessions += 1

    # 4. Calculate Streak
    if stats.last_meditated_at is None:
        stats.current_streak = 1
        stats.longest_streak = 1
    else:
        # Check if last meditation was today or yesterday
        last_date = stats.last_meditated_at.date()
        today_date = now.date()

        delta_days = (today_date - last_date).days

        if delta_days == 1:
            # Meditated yesterday, streak continues!
            stats.current_streak += 1
            if stats.current_streak > stats.longest_streak:
                stats.longest_streak = stats.current_streak
        elif delta_days > 1:
            # Missed a day, streak reset
            stats.current_streak = 1

        # If delta_days == 0, they already meditated today, streak remains unchanged.

    # 5. Update timestamp
    stats.last_meditated_at = now

    # We rely on the caller to commit.
    return history
