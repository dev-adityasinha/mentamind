import logging
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

import app.models  # noqa: F401 - ensures all models are registered with Base.metadata
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler

try:
    from fastapi_cache import FastAPICache
    from fastapi_cache.backends.redis import RedisBackend
    HAS_CACHE = True
except ImportError:
    HAS_CACHE = False
from app.middleware.cors import CorsMiddleware
from app.middleware.logging_mw import JSONFormatter, RequestLoggingMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.routers import (
    admin,
    ai_coach,
    auth,
    chat,
    dashboard,
    forum,
    hr_dashboard,
    invitations,
    journal,
    meditation,
    mood,
    notifications,
    onboarding,
    saml,
    screening,
    users,
    wellness,
)
from app.routers import settings as settings_router
from app.settings import settings

# Configure JSON structured logging once at startup. pytest sets its own
# handlers first; the guard below preserves them so caplog works in tests.
if not logging.root.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(JSONFormatter())
    logging.root.addHandler(_handler)
    logging.root.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(application: FastAPI):
    if settings.environment == "production":
        from app.services.auth_service import validate_secret_keys
        from app.services.encryption import validate_encryption_key

        validate_secret_keys()
        validate_encryption_key()
    
    if HAS_CACHE:
        r = redis.from_url(settings.redis_url, encoding="utf8", decode_responses=True)
        FastAPICache.init(RedisBackend(r), prefix="mentamind-cache")
    
    yield


# Docs disabled in production. The CSP is `default-src 'none'`, which blocks
# the Swagger UI CDN scripts even in dev; use a REST client (Postman, httpx)
# for manual testing outside of production.
_docs_url = None if settings.environment == "production" else "/docs"
_redoc_url = None if settings.environment == "production" else "/redoc"

app = FastAPI(
    title="Mentamind API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


_log = logging.getLogger("mentamind.error")


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all that logs the full traceback of any unhandled exception.

    Without this handler, Starlette's ServerErrorMiddleware silently swallows
    unhandled exceptions in production — it returns a generic 500 response
    but never writes the traceback anywhere durable.  The RequestLoggingMiddleware
    'except' clause (logging_mw.py:70) is never reached because ServerErrorMiddleware
    converts the exception to a response first.

    Render / Docker captures stdout, so JSON structured logging here ensures
    every 500 has a correlated traceback in the logs.
    """
    _log.exception(
        "Unhandled exception: method=%s path=%s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


# Middleware stack (last add_middleware = outermost = first to see requests).
# CorsMiddleware is outermost so it wraps ALL inner middlewares and the
# router.  Its ASGI-level send wrapper ensures CORS headers are injected into
# EVERY response — including 500 error responses — regardless of how inner
# middlewares handle exceptions.
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CorsMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(onboarding.router)
app.include_router(notifications.router)
app.include_router(invitations.router)
app.include_router(mood.router)
app.include_router(wellness.router)
app.include_router(forum.router)
app.include_router(screening.router)
app.include_router(ai_coach.router)
app.include_router(journal.router)
app.include_router(hr_dashboard.router)
app.include_router(settings_router.router)
app.include_router(saml.router)
app.include_router(chat.router)
app.include_router(meditation.router)
app.include_router(dashboard.router)

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
