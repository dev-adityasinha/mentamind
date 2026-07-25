"""IP-based rate limiting dependency for auth endpoints."""

import hashlib
import logging
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status

from app.client_ip import client_ip
from app.dependencies.redis_dep import get_redis_dep
from app.services.redis_client import RATE_CAP_LUA as _RATE_CAP_LUA

log = logging.getLogger(__name__)


def auth_rate_limit(*, endpoint: str, max_calls: int, window_seconds: int):
    """Dependency factory returning a per-IP rate limit for auth routes.

    Keyed on IP only (not username) so an attacker cannot lock out a specific
    account by deliberately tripping a per-username counter. Fails open when
    Redis is unreachable.
    """

    async def _dep(
        request: Request,
        redis: Annotated[aioredis.Redis, Depends(get_redis_dep)],
    ) -> None:
        ip = client_ip(request)
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
        key = f"ratelimit:auth:{endpoint}:{ip_hash}"
        try:
            count = await redis.eval(_RATE_CAP_LUA, 1, key, window_seconds)
            if int(count) > max_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(window_seconds)},
                )
        except HTTPException:
            raise
        except Exception:
            log.warning("rate_limit_redis_error endpoint=%s", endpoint)

    return Depends(_dep)
