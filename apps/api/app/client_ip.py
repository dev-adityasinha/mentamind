"""Canonical originating-client-IP resolution.

Shared by request logging and by both rate limiters so they all attribute a
request to the same address. Keeping one implementation matters: if the rate
limiter and the access log disagree, a throttled client is logged under a
different IP than the one that was actually throttled.
"""

from starlette.requests import Request

from app.settings import settings


def client_ip(request: Request) -> str:
    """Best-effort originating client IP.

    When ``behind_proxy`` is set, trust the first entry of X-Forwarded-For —
    the original client as recorded by the nearest trusted proxy. Otherwise use
    the direct peer address: an untrusted client can set X-Forwarded-For
    freely, so honouring it without a proxy in front would let anyone evade a
    per-IP rate limit by varying the header.
    """
    if settings.behind_proxy:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
