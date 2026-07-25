# Since we want a redis backend:
import redis
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

# By default, this uses an in-memory storage.
# We should ideally connect it to Redis via redis_url from settings for distributed setup,
# but for MVP in-memory or a basic redis connection is sufficient.
from app.client_ip import client_ip
from app.settings import settings

# Keyed on client_ip rather than slowapi's get_remote_address: the latter reads
# the direct peer, which behind the Next.js proxy is the web container for every
# user, so one shared bucket would throttle everyone at once.

# Using memory storage for tests and development to avoid Redis dependency locally
if settings.environment in ("test", "development"):
    redis_client = None
    limiter = Limiter(key_func=client_ip, storage_uri="memory://")
else:
    redis_client = redis.from_url(settings.redis_url)
    limiter = Limiter(key_func=client_ip, storage_uri=settings.redis_url)


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
