"""Notification service: in-app writes, SES stub, Redis rate cap, and quiet hours."""

import logging
import uuid
from datetime import UTC, datetime
from enum import StrEnum

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_event import (
    CATEGORY_RATE_CAP,
    NotificationCategory,
    NotificationEvent,
)
from app.services.encryption import encrypt
from app.services.redis_client import RATE_CAP_LUA as _RATE_CAP_LUA
from app.settings import settings

log = logging.getLogger(__name__)


class NotificationResult(StrEnum):
    SENT = "sent"
    RATE_LIMITED = "rate_limited"
    QUIET_HOURS = "quiet_hours"


def _in_quiet_hours(now_utc: datetime) -> bool:
    """Return True if now falls inside the configured quiet window (UTC)."""
    hour = now_utc.hour
    start = settings.notification_quiet_start
    end = settings.notification_quiet_end
    if start >= end:
        # Window wraps midnight (e.g. 22:00 -> 07:00)
        return hour >= start or hour < end
    return start <= hour < end


async def _check_rate_cap(
    redis: aioredis.Redis,
    user_id: uuid.UUID,
    category: NotificationCategory,
) -> bool:
    """Return True if the per-user per-category cap is exceeded.

    The Lua script is executed atomically on the Redis server; no race
    condition is possible between the INCR and the EXPIRE.
    """
    key = f"notif:rate:{user_id}:{category.value}"
    window = settings.notification_rate_window_seconds
    cap = CATEGORY_RATE_CAP[category]
    count = await redis.eval(_RATE_CAP_LUA, 1, key, window)
    return int(count) > cap


async def send_notification(
    *,
    db: AsyncSession,
    redis: aioredis.Redis,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    category: NotificationCategory,
    title: str,
    body: str,
    now_utc: datetime | None = None,
) -> NotificationResult:
    """Create an in-app notification record after enforcing quiet hours and rate cap.

    Returns the outcome so callers can decide whether to attempt an email
    fallback or simply log the suppression.
    """
    now_utc = now_utc or datetime.now(UTC)

    if _in_quiet_hours(now_utc):
        log.info(
            '{"event": "notification_suppressed", "reason": "quiet_hours", '
            '"user_id": "%s", "category": "%s"}',
            user_id,
            category.value,
        )
        return NotificationResult.QUIET_HOURS

    if await _check_rate_cap(redis, user_id, category):
        log.info(
            '{"event": "notification_suppressed", "reason": "rate_limited", '
            '"user_id": "%s", "category": "%s"}',
            user_id,
            category.value,
        )
        return NotificationResult.RATE_LIMITED

    body_encrypted = encrypt(body, associated_data=str(user_id).encode())
    event = NotificationEvent(
        user_id=user_id,
        org_id=org_id,
        category=category,
        title=title,
        body_encrypted=body_encrypted,
    )
    db.add(event)
    await db.commit()

    log.info(
        '{"event": "notification_sent", "user_id": "%s", "category": "%s"}',
        user_id,
        category.value,
    )
    return NotificationResult.SENT


async def notify_org_new_meditation(
    *,
    org_id: uuid.UUID,
    track_id: uuid.UUID,
    track_title: str,
    uploader_id: uuid.UUID,
) -> int:
    """Announce a newly-added meditation track to every member of the org.

    Fans out one in-app notification to each active member of ``org_id`` except
    the uploader. Designed to run as a FastAPI background task AFTER the upload
    response has been sent, so the admin's "create track" request never waits on
    the fan-out. It opens its OWN database session (the request-scoped session is
    already closed by the time a background task runs).

    Unlike ``send_notification``, this deliberately does NOT apply quiet-hours or
    the per-user reminder rate cap: this is a one-off content announcement, not a
    recurring reminder, so those suppressions would wrongly drop it (e.g. a track
    uploaded at night would reach nobody). Bodies are encrypted per-recipient
    with the exact same scheme the rest of the notification system uses, so they
    decrypt correctly in the notifications router.

    Returns the number of notifications created (useful for logging/tests).
    """
    # Imported lazily to avoid a circular import at module load time
    # (models.user does not import this service, but keeping the import local
    # also keeps this announcement-only helper self-contained).
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.user import User, UserRole
    from app.models.user_settings import UserSettings

    title = "New meditation added"
    body = f'A new session "{track_title}" was just added to your library.'

    created = 0
    async with AsyncSessionLocal() as db:
        # Recipients = the same "real, notifiable user" definition the reminder
        # scheduler uses (reminder_scheduler._eligible_users), scoped to this org
        # and excluding the uploader: active, onboarded, not anonymous, not
        # banned, and who have NOT disabled notifications in their settings.
        # notifications_enabled defaults True; a NULL (no settings row) is
        # treated as enabled, matching the scheduler.
        result = await db.execute(
            select(User.id)
            .outerjoin(UserSettings, UserSettings.user_id == User.id)
            .where(
                User.org_id == org_id,
                User.id != uploader_id,
                User.deleted_at.is_(None),
                User.is_banned.is_(False),
                User.is_anonymous.is_(False),
                User.onboarding_completed_at.is_not(None),
                User.role != UserRole.ANONYMOUS,
                (UserSettings.notifications_enabled.is_(None))
                | (UserSettings.notifications_enabled.is_(True)),
            )
        )
        recipient_ids = [row[0] for row in result.all()]

        for recipient_id in recipient_ids:
            body_encrypted = encrypt(body, associated_data=str(recipient_id).encode())
            db.add(
                NotificationEvent(
                    user_id=recipient_id,
                    org_id=org_id,
                    category=NotificationCategory.MEDITATION_REMINDER,
                    title=title,
                    body_encrypted=body_encrypted,
                )
            )
            created += 1

        # Single commit for the whole fan-out (atomic; far cheaper than one
        # commit per recipient for large orgs).
        await db.commit()

    log.info(
        '{"event": "meditation_announced", "org_id": "%s", "track_id": "%s", '
        '"recipients": %d}',
        org_id,
        track_id,
        created,
    )
    return created


async def send_email_ses_stub(
    *,
    email_hash: str,
    subject: str,
    body_preview: str,
) -> None:
    """Log-only SES stub. Replace implementation with boto3 SES call when ready.

    Accepts email_hash (never the raw address) so nothing PII-sensitive is
    logged. body_preview must not contain sensitive user data.
    """
    log.info(
        '{"event": "ses_stub_send", "email_hash_prefix": "%s", "subject": "%s", '
        '"body_preview": "%s"}',
        email_hash[:8] + "...",
        subject,
        body_preview[:80],
    )
