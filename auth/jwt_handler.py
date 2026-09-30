"""
auth/jwt_handler.py
-------------------
JWT token generation and validation.
Uses python-jose with HS256 algorithm.
Claims stored: user_id, email, role, iat, exp.
Passwords are NEVER stored in JWT.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import JWTError, jwt, ExpiredSignatureError

from config.settings import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRATION_MINUTES

logger = logging.getLogger(__name__)


class TokenExpiredError(Exception):
    """Raised when a JWT token has expired."""
    pass


class TokenInvalidError(Exception):
    """Raised when a JWT token is invalid or tampered with."""
    pass


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
    vendor_id: Optional[str] = None,
    vendor_category: Optional[str] = None,
) -> str:
    """
    Generate a signed JWT access token.

    Args:
        user_id: MongoDB ObjectId string for the user.
        email:   User's email address.
        role:    User's assigned role.
        expires_delta: Override default expiration if provided.
        vendor_id: For Vendor role — MongoDB ObjectId of the linked vendor record.
        vendor_category: For Vendor role — the vendor's category (e.g. 'Raw Material Suppliers').

    Returns:
        Encoded JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=JWT_EXPIRATION_MINUTES)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload: Dict[str, Any] = {
        "sub": user_id,          # Subject (user identifier)
        "email": email,
        "role": role,
        "iat": now,               # Issued At
        "exp": expire,            # Expiration
        "type": "access",
    }

    # Embed vendor claims for ROLE_VENDOR — used by API middleware for data isolation
    if vendor_id:
        payload["vendor_id"] = vendor_id
    if vendor_category:
        payload["vendor_category"] = vendor_category

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    logger.debug("Access token created for user: %s  role: %s  vendor_id: %s", email, role, vendor_id)
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.

    Args:
        token: Encoded JWT string.

    Returns:
        Decoded payload dict containing sub, email, role, etc.

    Raises:
        TokenExpiredError: If the token has expired.
        TokenInvalidError: If the token is invalid or tampered.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise TokenInvalidError("Token type mismatch.")
        return payload
    except ExpiredSignatureError:
        logger.warning("Expired JWT token presented.")
        raise TokenExpiredError("Session has expired. Please log in again.")
    except JWTError as exc:
        logger.warning("Invalid JWT token: %s", exc)
        raise TokenInvalidError("Invalid or tampered token.")


def get_token_claims(token: str) -> Optional[Dict[str, Any]]:
    """
    Safe wrapper around decode — returns None instead of raising.
    Useful for session checks where failure should redirect to login.
    """
    try:
        return decode_access_token(token)
    except (TokenExpiredError, TokenInvalidError):
        return None


def is_token_valid(token: str) -> bool:
    """Quick boolean check for token validity."""
    return get_token_claims(token) is not None
