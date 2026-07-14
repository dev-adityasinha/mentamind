import hashlib
import json
import logging
import time
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.settings import settings

_request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    return _request_id_var.get("")


def _hash_ip(ip: str) -> str:
    """12-char hex prefix of SHA-256(ip): enough for correlation, not reversible."""
    return hashlib.sha256(ip.encode()).hexdigest()[:12]


def _client_ip(request: Request) -> str:
    if settings.behind_proxy:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class JSONFormatter(logging.Formatter):
    """Single-line JSON log records with the current request_id embedded."""

    def format(self, record: logging.LogRecord) -> str:
        obj: dict = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": _request_id_var.get(""),
        }
        if record.exc_info:
            obj["exc"] = self.formatException(record.exc_info)
        return json.dumps(obj)


_log = logging.getLogger("mentamind.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        _token = _request_id_var.set(request_id)
        ip_hash = _hash_ip(_client_ip(request))
        start = time.monotonic()

        _log.info(
            "req_start method=%s path=%s ip_hash=%s",
            request.method,
            request.url.path,
            ip_hash,
        )

        try:
            response = await call_next(request)
        except Exception:
            _log.exception(
                "req_error method=%s path=%s",
                request.method,
                request.url.path,
            )
            raise
        finally:
            _request_id_var.reset(_token)

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        _log.info(
            "req_end method=%s path=%s status=%d ms=%.1f",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response
