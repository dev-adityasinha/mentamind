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
