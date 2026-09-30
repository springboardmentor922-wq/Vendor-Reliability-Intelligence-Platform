"""
utils/validators.py
-------------------
Input validation utilities for forms and API inputs.
"""

import re
from typing import Optional


# ── Email ─────────────────────────────────────────────────────────────────────
_EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


def validate_email_format(email: str) -> bool:
    """Return True if the email matches a valid format."""
    if not email or not isinstance(email, str):
        return False
    return bool(_EMAIL_REGEX.match(email.strip()))


# ── Required Fields ───────────────────────────────────────────────────────────

def validate_required(value: Optional[str], field_name: str = "Field") -> tuple[bool, str]:
    """Return (True, '') if value is non-empty, else (False, error_message)."""
    if not value or not str(value).strip():
        return False, f"{field_name} is required."
    return True, ""


def validate_all_required(fields: dict) -> tuple[bool, str]:
    """
    Validate multiple required fields at once.
    fields: {field_name: value}
    Returns (True, '') or (False, first error message).
    """
    for name, value in fields.items():
        ok, msg = validate_required(value, name)
        if not ok:
            return False, msg
    return True, ""


# ── Numeric ───────────────────────────────────────────────────────────────────

def validate_positive_number(value, field_name: str = "Value") -> tuple[bool, str]:
    """Validate that value is a positive number."""
    try:
        num = float(value)
        if num <= 0:
            return False, f"{field_name} must be greater than zero."
        return True, ""
    except (TypeError, ValueError):
        return False, f"{field_name} must be a valid number."


def validate_non_negative(value, field_name: str = "Value") -> tuple[bool, str]:
    """Validate that value is non-negative."""
    try:
        num = float(value)
        if num < 0:
            return False, f"{field_name} cannot be negative."
        return True, ""
    except (TypeError, ValueError):
        return False, f"{field_name} must be a valid number."


# ── Phone ─────────────────────────────────────────────────────────────────────
_PHONE_REGEX = re.compile(r"^\+?[\d\s\-().]{7,20}$")


def validate_phone(phone: str) -> tuple[bool, str]:
    """Basic phone number format check."""
    if not phone:
        return True, ""   # Optional field
    if not _PHONE_REGEX.match(phone.strip()):
        return False, "Please enter a valid phone number."
    return True, ""


# ── Vendor Code ───────────────────────────────────────────────────────────────
_VENDOR_CODE_REGEX = re.compile(r"^VND-\d{4}-[A-Z0-9]{4}$")


def validate_vendor_code(code: str) -> tuple[bool, str]:
    if not _VENDOR_CODE_REGEX.match(code):
        return False, "Vendor code must follow format VND-YYYY-XXXX."
    return True, ""


# ── Date ──────────────────────────────────────────────────────────────────────

def validate_date_range(start, end) -> tuple[bool, str]:
    """Validate that start date is before end date."""
    if start and end and start >= end:
        return False, "Start date must be before end date."
    return True, ""
