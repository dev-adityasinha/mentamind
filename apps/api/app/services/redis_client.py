"""Redis connection pool and shared Lua scripts used across the process lifetime."""

import redis.asyncio as aioredis

from app.settings import settings

# Atomic rate cap: INCR the counter, then set TTL only on the first write so
# the window doesn't reset on every request. Executed serially by Redis; cannot
# race under concurrent callers. Used by both the notification service and the
# auth rate limit dependency.
RATE_CAP_LUA = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""

_pool: aioredis.ConnectionPool | None = None


def get_redis_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url, decode_responses=True
        )
    return _pool


def get_redis() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=get_redis_pool())
