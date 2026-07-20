import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meditation import MeditationHistory, MeditationStats


def _week_start(d: date) -> date:
    """Return the Monday that starts the calendar week containing ``d`` (UTC).

    "Active this week" is measured over the Monday-to-Sunday week, so this
    gives the inclusive lower bound of the current week's date range.
    """
    return d - timedelta(days=d.weekday())


async def submit_meditation_completion(
    db: AsyncSession,
    user_id: uuid.UUID,
    track_id: uuid.UUID,
    duration_minutes: int,
) -> MeditationHistory:
    """
    Records a completed meditation track for a user and securely updates their
    global stats: total minutes/sessions, the daily streak (consecutive days),
    and "days active this week" (distinct days meditated in the current week).
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

    # 4b. Calculate "days active this week": how many DISTINCT calendar days in
    # the current Monday-Sunday week the user has completed a session on (0-7).
    #
    # This is derived from history rather than maintained as an incremental
    # counter, which makes it correct regardless of how many sessions run, in
    # what order, or how many happen on the same day. It naturally "resets" each
    # Monday because the query window (week_start .. today) moves forward.
    week_start = _week_start(now.date())

    # Distinct prior active days this week (rows already committed before now).
    # The row we just added above may not be flushed yet, so we compute the set
    # of prior days and add today's date explicitly — deterministic either way.
    result_days = await db.execute(
        select(func.distinct(func.date(MeditationHistory.completed_at))).where(
            MeditationHistory.user_id == user_id,
            func.date(MeditationHistory.completed_at) >= week_start,
        )
    )
    active_days: set[date] = set()
    for (d,) in result_days.all():
        # func.date() may return a date or an ISO string depending on the DB
        # driver; normalize both to a date object before adding to the set.
        active_days.add(d if isinstance(d, date) else date.fromisoformat(str(d)))
    active_days.add(now.date())  # include the session being recorded right now

    stats.weekly_streak = len(active_days)  # 1-7 (column reused; now = days/week)
    if stats.weekly_streak > stats.longest_weekly_streak:
        stats.longest_weekly_streak = stats.weekly_streak

    # 5. Update timestamp
    stats.last_meditated_at = now

    # We rely on the caller to commit.
    return history
