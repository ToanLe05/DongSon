"""Same-origin web host for independent, browser-local two-player matches.

Run one worker: python -m uvicorn web:app --app-dir src --host 0.0.0.0.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path
from secrets import token_urlsafe
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import server


COOKIE = "dongson_session"
PUBLIC_ROUTES = {"/ping", "/state", "/new_game", "/legal_moves", "/move", "/resign", "/draw"}


@dataclass
class Entry:
    game: server.GameSession = field(default_factory=server.GameSession)
    touched: float = field(default_factory=monotonic)
    active: int = 0


class SessionStore:
    """Accessed on the ASGI event loop; active requests cannot be expired."""
    def __init__(self, ttl=86400, capacity=1000):
        self.ttl = ttl
        self.capacity = capacity
        self.entries = {}

    def acquire(self, key):
        now = monotonic()
        for old_key, entry in list(self.entries.items()):
            if not entry.active and now - entry.touched >= self.ttl:
                del self.entries[old_key]
        entry = self.entries.get(key)
        if entry is None:
            if len(self.entries) >= self.capacity:
                return None
            key = token_urlsafe(32)
            entry = Entry()
            entry.game.strict = True
            self.entries[key] = entry
        entry.touched = now
        entry.active += 1
        return key, entry


def create_app(web_root=None, *, ttl=86400, capacity=1000):
    root = Path(web_root or Path(__file__).resolve().parents[1] / "dist")
    host = FastAPI(title="Cờ Đông Sơn", docs_url=None, redoc_url=None, openapi_url=None)
    store = host.state.sessions = SessionStore(ttl, capacity)

    @host.middleware("http")
    async def browser_session(request: Request, call_next):
        path = request.url.path
        api = path == "/api" or path.startswith("/api/")
        if not api:
            response = await call_next(request)
        else:
            if path.removeprefix("/api") not in PUBLIC_ROUTES:
                return JSONResponse({"detail": "Not found"}, status_code=404)
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                origin = request.headers.get("origin")
                if origin and origin.rstrip("/") != str(request.base_url).rstrip("/"):
                    return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
                if request.headers.get("sec-fetch-site") == "cross-site":
                    return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
                if request.headers.get("content-type", "").split(";")[0] != "application/json":
                    return JSONResponse({"detail": "Expected application/json"}, status_code=415)
            if path == "/api/ping":
                return JSONResponse({"ok": True})
            acquired = store.acquire(request.cookies.get(COOKIE))
            if acquired is None:
                return JSONResponse({"detail": "Máy chủ đang bận. Vui lòng thử lại sau."}, status_code=503)
            key, entry = acquired
            token = server.session_context.set(entry.game)
            try:
                response = await call_next(request)
            finally:
                server.session_context.reset(token)
                entry.active -= 1
                entry.touched = monotonic()
            response.set_cookie(COOKIE, key, max_age=ttl, httponly=True,
                                secure=request.url.scheme == "https", samesite="strict", path="/api")
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if path == "/" or path.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        return response

    @host.get("/health")
    def health():
        ready = (root / "index.html").is_file()
        return JSONResponse({"ok": ready, "frontend": ready}, status_code=200 if ready else 503)

    host.mount("/api", server.app)
    host.mount("/", StaticFiles(directory=root, html=True, check_dir=False), name="web")
    return host


app = create_app(capacity=int(os.environ.get("DONGSON_MAX_SESSIONS", "1000")))
