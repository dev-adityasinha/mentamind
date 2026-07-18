import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meditation import MeditationHistory, MeditationStats


def _week_index(d: date) -> int:
    """Return a monotonic week number so consecutive calendar weeks differ by 1.

    Uses the ordinal of the Monday that starts the week, divided by 7. This is
    stable across year boundaries (unlike raw ISO year/week numbers, where the
    week number wraps back to 1 each January).
    """
    monday = d - timedelta(days=d.weekday())
    return monday.toordinal() // 7


async def submit_meditation_completion(
    db: AsyncSession,
    user_id: uuid.UUID,
    track_id: uuid.UUID,
    duration_minutes: int,
) -> MeditationHistory:
    """
    Records a completed meditation track for a user and securely updates their
    global stats. Calculates both daily and weekly streak logic.
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
            longest_streak=0,
            weekly_streak=0,
            longest_weekly_streak=0,
        )
        db.add(stats)

    # Capture the previous timestamp BEFORE we overwrite it, so both the daily
    # and weekly streak calculations compare against the same prior value.
    previous_meditated_at = stats.last_meditated_at

    # 3. Update basic counts
    stats.total_minutes += duration_minutes
    stats.total_sessions += 1

    # 4. Calculate daily streak
    if previous_meditated_at is None:
        stats.current_streak = 1
        stats.longest_streak = 1
    else:
        # Check if last meditation was today or yesterday
        last_date = previous_meditated_at.date()
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

        # If delta_days == 0, they already meditated today, streak unchanged.

    # 4b. Calculate weekly streak (consecutive calendar weeks with a session)
    if previous_meditated_at is None:
        stats.weekly_streak = 1
        stats.longest_weekly_streak = 1
    else:
        delta_weeks = _week_index(now.date()) - _week_index(
            previous_meditated_at.date()
        )
        if delta_weeks == 1:
            # Meditated last week, weekly streak continues.
            stats.weekly_streak += 1
            if stats.weekly_streak > stats.longest_weekly_streak:
                stats.longest_weekly_streak = stats.weekly_streak
        elif delta_weeks > 1:
            # Missed one or more full weeks, weekly streak resets.
            stats.weekly_streak = 1
        # delta_weeks == 0 means already meditated this week; leave unchanged.
        if stats.longest_weekly_streak < stats.weekly_streak:
            stats.longest_weekly_streak = stats.weekly_streak

    # 5. Update timestamp
    stats.last_meditated_at = now

    # We rely on the caller to commit.
    return history
