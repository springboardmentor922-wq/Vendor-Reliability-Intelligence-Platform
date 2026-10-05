"""Live system monitoring for the Administrator dashboard.

A lightweight ASGI middleware times every API request and remembers which
users were active recently. Nothing here is estimated: response times are the
measured wall-clock latency of real requests, active sessions are users whose
token was seen on a request inside the session window, and uptime is how long
this API process has been serving.
"""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

import jwt

from security import decode_token

STARTED_AT = time.time()
STARTED_AT_ISO = datetime.now(timezone.utc).isoformat()

SESSION_WINDOW_SECONDS = 15 * 60
SAMPLE_SIZE = 2000

_lock = threading.Lock()
_samples: deque[tuple[float, float, int]] = deque(maxlen=SAMPLE_SIZE)  # (at, ms, status)
_last_seen: dict[int, float] = {}
_total_requests = 0
_total_errors = 0

# Polling endpoints would otherwise dominate the latency sample and make the
# figure describe the monitor rather than the application.
_EXCLUDED_PREFIXES = ("/dashboards/live", "/health", "/docs", "/openapi.json", "/uploads")


def _user_from_headers(headers: list[tuple[bytes, bytes]]) -> Optional[int]:
    for name, value in headers:
        if name == b"authorization":
            raw = value.decode("latin-1")
            if raw.lower().startswith("bearer "):
                try:
                    payload = decode_token(raw[7:].strip())
                    sub = payload.get("sub")
                    return int(sub) if sub else None
                except (jwt.PyJWTError, ValueError):
                    return None
    return None


class MonitoringMiddleware:
    """Pure ASGI middleware - avoids BaseHTTPMiddleware's streaming overhead."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        started = time.perf_counter()
        status_holder = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message["status"]
            await send(message)

        user_id = _user_from_headers(scope.get("headers", []))

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            record(path, elapsed_ms, status_holder["code"], user_id, scope.get("method", "GET"))


def record(path: str, elapsed_ms: float, status_code: int, user_id: Optional[int], method: str = "GET") -> None:
    global _total_requests, _total_errors

    now = time.time()

    with _lock:
        if user_id is not None:
            _last_seen[user_id] = now

        if method == "OPTIONS" or path.startswith(_EXCLUDED_PREFIXES):
            return

        _total_requests += 1
        if status_code >= 500:
            _total_errors += 1

        _samples.append((now, elapsed_ms, status_code))


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(pct / 100 * (len(ordered) - 1))))
    return ordered[index]


def _dir_size(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return total


def snapshot(upload_dir: str) -> dict:
    now = time.time()

    with _lock:
        samples = list(_samples)
        active_sessions = sum(1 for seen in _last_seen.values() if now - seen <= SESSION_WINDOW_SECONDS)
        total_requests = _total_requests
        total_errors = _total_errors

    latencies = [ms for _, ms, _ in samples]
    last_minute = [s for s in samples if now - s[0] <= 60]
    errors = sum(1 for _, _, code in samples if code >= 500)

    # Per-minute series for the last 15 minutes (oldest first).
    series = []
    for minute in range(14, -1, -1):
        lo, hi = now - (minute + 1) * 60, now - minute * 60
        bucket = [ms for at, ms, _ in samples if lo < at <= hi]
        series.append({
            "minute": datetime.fromtimestamp(hi, timezone.utc).strftime("%H:%M"),
            "requests": len(bucket),
            "avg_ms": round(sum(bucket) / len(bucket), 1) if bucket else 0.0,
        })

    uptime = now - STARTED_AT

    return {
        "started_at": STARTED_AT_ISO,
        "uptime_seconds": int(uptime),
        # The process has served continuously since start; availability is the
        # share of measured requests that did not fail with a server error.
        "availability_pct": round(100.0 * (1 - (errors / len(samples))), 2) if samples else 100.0,
        "api_avg_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        "api_p95_ms": round(_percentile(latencies, 95), 1),
        "requests_last_minute": len(last_minute),
        "requests_sampled": len(samples),
        "total_requests": total_requests,
        "total_server_errors": total_errors,
        "active_sessions": active_sessions,
        "session_window_minutes": SESSION_WINDOW_SECONDS // 60,
        "storage_bytes": _dir_size(upload_dir),
        "latency_series": series,
    }
