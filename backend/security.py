"""Password hashing and JWT token helpers.

Uses ``bcrypt`` directly rather than passlib: passlib 1.7.4 reads
``bcrypt.__about__``, which bcrypt 5.x no longer ships.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt

from config import settings

# bcrypt only consumes the first 72 bytes of a password.
_BCRYPT_MAX_BYTES = 72

ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"


def _to_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            _to_bytes(plain_password),
            password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra: Optional[dict[str, Any]] = None
) -> str:
    now = datetime.now(timezone.utc)

    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta
    }

    if extra:
        payload.update(extra)

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def create_access_token(user_id: int, role: str, email: str) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=ACCESS_TOKEN,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra={"role": role, "email": email}
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=REFRESH_TOKEN,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode a JWT. Raises ``jwt.PyJWTError`` when invalid or expired."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM]
    )


# ---------------------------------------------------------------
# Password reset tokens
# ---------------------------------------------------------------

def generate_reset_token() -> tuple[str, str]:
    """Return ``(raw_token, token_hash)``; only the hash is persisted."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_reset_token(raw)


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
