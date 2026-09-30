"""
auth/session.py
---------------
Streamlit session state management for the Vendor Reliability Intelligence Platform.
Handles login, logout, token validation, role-aware page guards, and session persistence.
"""

import logging
from typing import Optional, Dict, Any

import streamlit as st

from auth.jwt_handler import get_token_claims, TokenExpiredError, TokenInvalidError
from auth.permissions import has_page_access, get_allowed_pages

logger = logging.getLogger(__name__)

# ── Session State Keys ────────────────────────────────────────────────────────
SESSION_TOKEN = "auth_token"
SESSION_USER = "current_user"
SESSION_ROLE = "user_role"
SESSION_PAGE = "current_page"
SESSION_IS_AUTHENTICATED = "is_authenticated"


def init_session() -> None:
    """
    Initialize all session state keys if not already set.
    Must be called at the top of app.py before any other session access.
    """
    defaults = {
        SESSION_TOKEN: None,
        SESSION_USER: None,
        SESSION_ROLE: None,
        SESSION_PAGE: "dashboard",
        SESSION_IS_AUTHENTICATED: False,
    }
    for key, default_val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default_val


def login_user(token: str, user_data: Dict[str, Any]) -> None:
    """
    Persist an authenticated user into Streamlit session state.

    Args:
        token:     The JWT access token returned after successful authentication.
        user_data: The user document from MongoDB (without password_hash).
    """
    claims = get_token_claims(token)
    if claims is None:
        raise ValueError("Cannot establish session: token is invalid or expired.")

    st.session_state[SESSION_TOKEN] = token
    st.session_state[SESSION_ROLE] = claims.get("role")
    st.session_state[SESSION_IS_AUTHENTICATED] = True
    st.session_state[SESSION_PAGE] = "dashboard"
    # Sync JWT-embedded vendor claims into user dict for data isolation
    user_with_claims = dict(user_data)
    if claims.get("vendor_id"):
        user_with_claims["vendor_id"] = claims["vendor_id"]
    if claims.get("vendor_category"):
        user_with_claims["vendor_category"] = claims["vendor_category"]
    st.session_state[SESSION_USER] = user_with_claims
    logger.info(
        "Session started for user: %s  role: %s  vendor_id: %s",
        claims.get("email"), claims.get("role"), claims.get("vendor_id"),
    )


def logout_user() -> None:
    """
    Clear all authentication-related session state.
    Redirects back to the login page.
    """
    email = ""
    if st.session_state.get(SESSION_USER):
        email = st.session_state[SESSION_USER].get("email", "")

    st.session_state[SESSION_TOKEN] = None
    st.session_state[SESSION_USER] = None
    st.session_state[SESSION_ROLE] = None
    st.session_state[SESSION_IS_AUTHENTICATED] = False
    st.session_state[SESSION_PAGE] = "login"
    logger.info("Session ended for user: %s", email)


def is_authenticated() -> bool:
    """
    Return True if the current session has a valid, non-expired JWT token.
    Automatically logs out if the token is expired.
    """
    token = st.session_state.get(SESSION_TOKEN)
    if not token:
        return False

    claims = get_token_claims(token)
    if claims is None:
        # Token expired or invalid — force logout
        logout_user()
        return False

    return True


def get_current_user() -> Optional[Dict[str, Any]]:
    """Return the current user dict, or None if not authenticated."""
    if not is_authenticated():
        return None
    return st.session_state.get(SESSION_USER)


def get_current_role() -> Optional[str]:
    """Return the role of the currently logged-in user, or None."""
    if not is_authenticated():
        return None
    return st.session_state.get(SESSION_ROLE)


def get_current_token() -> Optional[str]:
    """Return the current JWT token string."""
    return st.session_state.get(SESSION_TOKEN)


def navigate_to(page: str) -> None:
    """Set the active page in session state."""
    st.session_state[SESSION_PAGE] = page


def get_current_page() -> str:
    """Return the currently active page key."""
    return st.session_state.get(SESSION_PAGE, "dashboard")


def require_auth() -> bool:
    """
    Page guard — call at the top of every protected page.
    Returns True if user is authenticated, False (and redirects) otherwise.
    """
    if not is_authenticated():
        st.session_state[SESSION_PAGE] = "login"
        st.rerun()
        return False
    return True


def require_page_permission(page_key: str) -> bool:
    """
    Check that the current user has permission to view a specific page.
    Redirects to dashboard if access is denied.
    """
    role = get_current_role()
    if not role or not has_page_access(role, page_key):
        st.error(" You do not have permission to access this page.")
        st.session_state[SESSION_PAGE] = "dashboard"
        st.rerun()
        return False
    return True
