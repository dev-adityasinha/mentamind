"""ASGI-level CORS middleware that always sets CORS headers, even on errors.

Starlette's built-in CORSMiddleware fails to add CORS headers when a
BaseHTTPMiddleware subclass in the chain catches and re-raises an exception,
because the ASGI send wrapper is never called. This implementation catches
exceptions from the inner app and injects CORS headers into the error
response before it reaches the client.
"""

from __future__ import annotations

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import PlainTextResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class CorsMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        allow_origins: list[str] | None = None,
        allow_credentials: bool = False,
        allow_methods: list[str] | None = None,
        allow_headers: list[str] | None = None,
        expose_headers: list[str] | None = None,
    ) -> None:
        self.app = app
        self.allow_origins = allow_origins or []
        self.allow_credentials = allow_credentials
        self.allow_methods = allow_methods or []
        self.allow_headers = allow_headers or []
        self.expose_headers = expose_headers or []

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        origin = headers.get("origin")

        if origin is None:
            await self.app(scope, receive, send)
            return

        if not self._origin_allowed(origin):
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")

        if method == "OPTIONS":
            response = Response(
                status_code=204,
                headers=self._cors_headers(origin),
            )
            await response(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                m_headers = MutableHeaders(scope=message)
                for key, value in self._cors_headers(origin).items():
                    m_headers.append(key, value)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            response = PlainTextResponse(
                "Internal Server Error",
                status_code=500,
                headers=self._cors_headers(origin),
            )
            await response(scope, receive, send)

    def _origin_allowed(self, origin: str) -> bool:
        if origin in self.allow_origins:
            return True
        if "*" in self.allow_origins:
            return True
        for pattern in self.allow_origins:
            if pattern.startswith("http://*.") or pattern.startswith("https://*."):
                base = pattern.split("*.")[1]
                if origin.endswith("." + base):
                    return True
        return False

    def _cors_headers(self, origin: str) -> dict[str, str]:
        headers: dict[str, str] = {}
        headers["Access-Control-Allow-Origin"] = origin
        if self.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"
        if self.allow_methods:
            headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
        if self.allow_headers:
            headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
        if self.expose_headers:
            headers["Access-Control-Expose-Headers"] = ", ".join(self.expose_headers)
        return headers
