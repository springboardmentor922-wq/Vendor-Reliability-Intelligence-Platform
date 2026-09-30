"""
utils/helpers.py
----------------
General-purpose helper utilities for the Vendor Reliability Intelligence Platform.
"""

import random
import string
from datetime import datetime, timezone
from typing import Optional, Any


# ── ID / Code Generators ──────────────────────────────────────────────────────

def generate_vendor_code() -> str:
    """
    Generate a unique vendor code in the format VND-YYYY-XXXX.
    Example: VND-2024-A3F7
    """
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"VND-{year}-{suffix}"


def generate_request_number() -> str:
    """
    Generate a procurement request number.
    Example: PR-20240821-0042
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = random.randint(1, 9999)
    return f"PR-{date_str}-{rand:04d}"


def generate_po_number() -> str:
    """
    Generate a purchase order number.
    Example: PO-20240821-0099
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = random.randint(1, 9999)
    return f"PO-{date_str}-{rand:04d}"


def generate_delivery_number() -> str:
    """Generate a delivery tracking number."""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = random.randint(1, 9999)
    return f"DEL-{date_str}-{rand:04d}"


def generate_contract_number() -> str:
    """Generate a contract number."""
    year = datetime.now(timezone.utc).year
    rand = random.randint(1000, 9999)
    return f"CON-{year}-{rand}"


# ── Date & Time Formatting ─────────────────────────────────────────────────────

def format_datetime(dt: Optional[datetime], fmt: str = "%d %b %Y, %H:%M") -> str:
    """Format a datetime object for display. Returns 'N/A' if None."""
    if dt is None:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime(fmt)


def format_date(dt: Optional[datetime]) -> str:
    """Format date only."""
    return format_datetime(dt, fmt="%d %b %Y")


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format a monetary amount for display."""
    return f"{currency} {amount:,.2f}"


def days_ago(dt: Optional[datetime]) -> str:
    """Return a human-readable 'X days ago' string."""
    if dt is None:
        return "Unknown"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = now - dt
    days = delta.days
    if days == 0:
        minutes = delta.seconds // 60
        if minutes < 1:
            return "Just now"
        if minutes < 60:
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        hours = minutes // 60
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    if days == 1:
        return "Yesterday"
    if days < 30:
        return f"{days} days ago"
    if days < 365:
        months = days // 30
        return f"{months} month{'s' if months != 1 else ''} ago"
    years = days // 365
    return f"{years} year{'s' if years != 1 else ''} ago"


# ── Status Colors ─────────────────────────────────────────────────────────────

STATUS_COLORS = {
    # General
    "Active": "#3F6B4F",
    "Inactive": "#68707C",
    "Suspended": "#8B3038",
    "Pending": "#A67C32",
    # Approval
    "Approved": "#3F6B4F",
    "Rejected": "#8B3038",
    # PO
    "Draft": "#68707C",
    "Issued": "#3E4A61",
    "Confirmed": "#172033",
    "In Transit": "#A67C32",
    "Delivered": "#3F6B4F",
    "Partially Delivered": "#B85C38",
    "Cancelled": "#8B3038",
    "Disputed": "#8B3038",
    # Compliance
    "Compliant": "#3F6B4F",
    "Non-Compliant": "#8B3038",
    "Under Review": "#A67C32",
    "Expired": "#68707C",
    # Notifications
    "Info": "#3E4A61",
    "Warning": "#A67C32",
    "Alert": "#8B3038",
    "Success": "#3F6B4F",
}


def get_status_color(status: str) -> str:
    """Return the hex color for a status label."""
    return STATUS_COLORS.get(status, "#68707C")


def get_status_badge_html(status: str) -> str:
    """Return an HTML span with colored badge styling for a status."""
    color = get_status_color(status)
    return (
        f'<span style="background:{color}20;color:{color};padding:2px 10px;'
        f'border-radius:12px;font-size:0.8rem;font-weight:600;">{status}</span>'
    )


# ── Misc ──────────────────────────────────────────────────────────────────────

def truncate_text(text: str, max_length: int = 50) -> str:
    """Truncate text to max_length and add ellipsis."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def safe_str(value: Any, default: str = "N/A") -> str:
    """Convert a value to string, returning default if None or empty."""
    if value is None or str(value).strip() == "":
        return default
    return str(value)
