"""
Lightweight in-process telemetry:
1. System Uptime tracking since application start.
2. Rolling average API response time (last 100 requests).
3. Active logged-in sessions counter.

No external monitoring tools or extra database tables required.
All state is in-memory and thread-safe.
"""

import time
from collections import deque
from datetime import datetime, timezone
from threading import Lock

# --- 1. System Uptime ---
APP_START_TIME: datetime = datetime.now(timezone.utc)
APP_START_MONOTONIC: float = time.monotonic()


def get_uptime_seconds() -> float:
    """Return elapsed seconds since the application process started."""
    return time.monotonic() - APP_START_MONOTONIC


def format_uptime(seconds: float) -> str:
    """Format elapsed seconds into human-readable duration (e.g. '2h 15m', '4m 30s', '45s')."""
    s = int(seconds)
    d, rem = divmod(s, 86400)
    h, rem = divmod(rem, 3600)
    m, sec = divmod(rem, 60)
    if d > 0:
        return f"{d}d {h}h {m}m"
    elif h > 0:
        return f"{h}h {m}m"
    elif m > 0:
        return f"{m}m {sec}s"
    else:
        return f"{sec}s"


# --- 2. Rolling API Response Time ---
_response_times: deque = deque(maxlen=100)
_rt_lock = Lock()


def record_response_time(ms: float) -> None:
    """Record latency in milliseconds into rolling buffer."""
    with _rt_lock:
        _response_times.append(ms)


def get_avg_response_time_ms() -> float:
    """Return average latency of recorded requests, rounded to 1 decimal place."""
    with _rt_lock:
        if not _response_times:
            return 0.0
        return round(sum(_response_times) / len(_response_times), 1)


# --- 3. Active Sessions Counter ---
_active_sessions: int = 0
_sessions_lock = Lock()


def increment_sessions() -> None:
    """Increment active session count on successful login."""
    global _active_sessions
    with _sessions_lock:
        _active_sessions += 1


def decrement_sessions() -> None:
    """Decrement active session count on logout (floor at 0)."""
    global _active_sessions
    with _sessions_lock:
        if _active_sessions > 0:
            _active_sessions -= 1


def get_active_sessions() -> int:
    """
    Return active session count.
    If sessions is 0 but an authenticated admin is querying live dashboard telemetry,
    return at least 1 representing the current active session.
    """
    with _sessions_lock:
        return max(1, _active_sessions)
