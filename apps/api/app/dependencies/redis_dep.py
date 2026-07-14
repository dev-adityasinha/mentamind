"""Shared FastAPI dependency for Redis.

Import get_redis_dep (not redis_client.get_redis directly) in routers so that
tests can override it uniformly with app.dependency_overrides[get_redis_dep].
"""

import redis.asyncio as aioredis

from app.services.redis_client import get_redis


def get_redis_dep() -> aioredis.Redis:
    return get_redis()
