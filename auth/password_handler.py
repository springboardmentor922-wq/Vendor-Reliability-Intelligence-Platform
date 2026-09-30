"""
auth/password_handler.py
------------------------
Secure password hashing and verification using bcrypt directly.
Plaintext passwords are NEVER stored or logged.

Note: Uses bcrypt directly (not passlib) for full Python 3.13 compatibility.
passlib has a known incompatibility with bcrypt 4.x on Python 3.13.
"""

import logging
import bcrypt as _bcrypt_lib
from config.settings import MIN_PASSWORD_LENGTH

logger = logging.getLogger(__name__)


def hash_password(plain_password: str) -> str:
    """
    Hash a plaintext password using bcrypt.

    Args:
        plain_password: The user's plaintext password.

    Returns:
        A bcrypt hash string suitable for storing in MongoDB.
    """
    password_bytes = plain_password.encode("utf-8")
    salt = _bcrypt_lib.gensalt(rounds=12)
    hashed = _bcrypt_lib.hashpw(password_bytes, salt)
    logger.debug("Password hashed successfully.")
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.

    Args:
        plain_password:  The password supplied during login.
        hashed_password: The stored bcrypt hash from MongoDB.

    Returns:
        True if the password matches, False otherwise.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return _bcrypt_lib.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets minimum security requirements.

    Rules:
        - At least MIN_PASSWORD_LENGTH characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character

    Returns:
        Tuple of (is_valid: bool, message: str)
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit."

    special_chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character."

    return True, "Password meets requirements."
