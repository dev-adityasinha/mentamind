# Since we want a redis backend:
import redis
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# By default, this uses an in-memory storage.
# We should ideally connect it to Redis via redis_url from settings for distributed setup,
# but for MVP in-memory or a basic redis connection is sufficient.
from app.settings import settings

# Using memory storage for tests to avoid Redis dependency
if settings.environment == "test":
    redis_client = None
    limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
else:
    redis_client = redis.from_url(settings.redis_url)
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)


def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    response = JSONResponse(
        {"error": f"Rate limit exceeded: {exc.detail}"}, status_code=429
    )
    response = request.app.state.limiter._inject_headers(
        response, request.state.view_rate_limit
    )
    return response
