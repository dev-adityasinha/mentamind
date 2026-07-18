"""Background scheduler that emits reminder notifications from real user state.

Uses APScheduler (already a project dependency) with an AsyncIO scheduler wired
into the FastAPI lifespan. Three daily jobs run, each deriving recipients from
actual database rows — never a hardcoded list:

- Daily mood reminder      : users with no mood log today.
- Meditation reminder      : users who have meditated before but not today.
- Assessment reminder      : users whose last assessment is >14 days old
                             (or who have never taken one).

Every send goes through send_notification(), so per-user quiet-hours and the
per-category Redis rate cap are enforced (the rate cap makes each reminder
effectively at-most-once-per-day even if a job is retried).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.meditation import MeditationStats
from app.models.mood_log import MoodLog
from app.models.notification_event import NotificationCategory
from app.models.test_score import TestScore
from app.models.user import User, UserRole
from app.models.user_settings import UserSettings
from app.services.notification import send_notification
from app.services.redis_client import get_redis

log = logging.getLogger("mentamind.scheduler")

# How stale a user's last assessment must be before we nudge them.
_ASSESSMENT_STALE_DAYS = 14


async def _eligible_users(db: AsyncSession) -> list[User]:
    """Real, notifiable users: active, onboarded, not anonymous, not banned,
    and who have not disabled notifications in their settings."""
    result = await db.execute(
        select(User)
        .outerjoin(UserSettings, UserSettings.user_id == User.id)
        .where(
            User.deleted_at.is_(None),
            User.is_banned.is_(False),
            User.is_anonymous.is_(False),
            User.onboarding_completed_at.is_not(None),
            User.role != UserRole.ANONYMOUS,
            # notifications_enabled defaults True; treat NULL (no settings row) as enabled.
            (UserSettings.notifications_enabled.is_(None))
            | (UserSettings.notifications_enabled.is_(True)),
        )
    )
    return list(result.scalars().all())


async def run_daily_mood_reminders() -> int:
    """Send a check-in reminder to every eligible user with no mood log today."""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    redis = get_redis()
    sent = 0
    async with AsyncSessionLocal() as db:
        for user in await _eligible_users(db):
            has_today = await db.execute(
                select(func.count(MoodLog.id)).where(
                    MoodLog.user_id == user.id,
                    MoodLog.logged_at >= today_start,
                )
            )
            if (has_today.scalar() or 0) > 0:
                continue
            result = await send_notification(
                db=db,
                redis=redis,
                user_id=user.id,
                org_id=user.org_id,
                category=NotificationCategory.CHECKIN_REMINDER,
                title="How are you feeling today?",
                body="Take a moment to log your mood and check in with yourself.",
                now_utc=now,
            )
            if result.value == "sent":
                sent += 1
    log.info('{"event": "mood_reminders", "sent": %d}', sent)
    return sent


async def run_meditation_reminders() -> int:
    """Nudge users who have meditated before but not yet today."""
    now = datetime.now(UTC)
    today = now.date()
    redis = get_redis()
    sent = 0
    async with AsyncSessionLocal() as db:
        eligible = {u.id: u for u in await _eligible_users(db)}
        if not eligible:
            return 0
        stats_rows = await db.execute(
            select(MeditationStats).where(
                MeditationStats.user_id.in_(list(eligible.keys()))
            )
        )
        for stats in stats_rows.scalars().all():
            # Only remind users who have an established habit (>=1 session) and
            # have not meditated today.
            if stats.total_sessions <= 0:
                continue
            if stats.last_meditated_at and stats.last_meditated_at.date() == today:
                continue
            user = eligible[stats.user_id]
            result = await send_notification(
                db=db,
                redis=redis,
                user_id=user.id,
                org_id=user.org_id,
                category=NotificationCategory.MEDITATION_REMINDER,
                title="Time for a mindful break",
                body="A short meditation can help you reset. Ready for today's session?",
                now_utc=now,
            )
            if result.value == "sent":
                sent += 1
    log.info('{"event": "meditation_reminders", "sent": %d}', sent)
    return sent


async def run_assessment_reminders() -> int:
    """Remind users whose most recent assessment is stale (or absent)."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=_ASSESSMENT_STALE_DAYS)
    redis = get_redis()
    sent = 0
    async with AsyncSessionLocal() as db:
        for user in await _eligible_users(db):
            # Count assessments taken within the freshness window (DB-side
            # comparison keeps this correct regardless of tz-awareness).
            recent_res = await db.execute(
                select(func.count(TestScore.id)).where(
                    TestScore.user_id == user.id,
                    TestScore.created_at >= cutoff,
                )
            )
            if (recent_res.scalar() or 0) > 0:
                continue
            result = await send_notification(
                db=db,
                redis=redis,
                user_id=user.id,
                org_id=user.org_id,
                category=NotificationCategory.ASSESSMENT_REMINDER,
                title="Check in on your wellbeing",
                body=(
                    "It's been a while since your last assessment. "
                    "A quick check-in helps you track how you're doing."
                ),
                now_utc=now,
            )
            if result.value == "sent":
                sent += 1
    log.info('{"event": "assessment_reminders", "sent": %d}', sent)
    return sent


def create_scheduler():
    """Build the AsyncIOScheduler with the three reminder jobs.

    Times are UTC. Jobs are scheduled outside the notification quiet window
    (default 22:00-07:00 UTC) so sends are not immediately suppressed.
    """
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        run_daily_mood_reminders,
        CronTrigger(hour=9, minute=0),
        id="daily_mood_reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        run_meditation_reminders,
        CronTrigger(hour=18, minute=0),
        id="meditation_reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        run_assessment_reminders,
        CronTrigger(hour=10, minute=0),
        id="assessment_reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    return scheduler
