"""
components/sidebar.py
---------------------
Role-aware navigation sidebar for VendorPulse — Reliable Vendors. Smarter Procurement.
Uses Deep Navy #172033 with Muted Gold #B08D57 accent. Zero emoji.
"""

import time
import streamlit as st
from auth.session import (
    get_current_user,
    get_current_role,
    navigate_to,
    get_current_page,
    logout_user,
)
from auth.permissions import get_navigation_sections


def _get_unread_count_cached(user_id: str) -> int:
    """
    Return unread notification count with a 30-second session-state TTL.

    Without this, every widget interaction in any page triggers a
    MongoDB count_documents call because the sidebar re-renders on
    every Streamlit rerun.
    """
    now = time.time()
    cache_key = f"_notif_count_{user_id}"
    ts_key = f"_notif_count_ts_{user_id}"

    cached_count = st.session_state.get(cache_key)
    last_ts = st.session_state.get(ts_key, 0)

    if cached_count is None or (now - last_ts) > 30:
        from services.notification_service import get_unread_count
        try:
            cached_count = get_unread_count(user_id)
        except Exception:
            cached_count = 0
        st.session_state[cache_key] = cached_count
        st.session_state[ts_key] = now

    return cached_count


ICONS: dict = {
    "grid": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    "users": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    "tag": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    "check-circle": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    "box": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    "file-text": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    "dollar-sign": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    "clipboard": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    "message-square": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    "bar-chart-2": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    "shield": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    "trending-up": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    "book-open": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    "bell": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    "settings": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    "user": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    "log-out": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
}


def _get_icon(icon_key: str, color: str = "currentColor") -> str:
    """Return inline SVG for a named icon."""
    svg = ICONS.get(icon_key, ICONS["grid"])
    return svg.replace('stroke="currentColor"', f'stroke="{color}"')


def render_sidebar() -> None:
    """
    Render the main fixed navigation sidebar.
    Deep Navy #172033 enterprise style with Muted Gold #B08D57 accent.
    """
    user = get_current_user()
    role = get_current_role()
    current_page = get_current_page()

    if not user or not role:
        return

    with st.sidebar:
        # ── Brand Header ──────────────────────────────────────────────────────
        st.markdown(
            '<div style="padding:0.85rem 0.5rem 0.7rem;border-bottom:1px solid #2A3548;margin-bottom:0.75rem;">'
            '<div style="font-size:1.2rem;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;display:flex;align-items:center;gap:10px;">'
            '<div style="width:30px;height:30px;background:#B08D57;border-radius:7px;'
            'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(176,141,87,0.35);">'
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
            '</div>'
            '<span>VendorPulse</span>'
            '</div>'
            '<div style="font-size:0.67rem;color:#68707C;margin-top:5px;padding-left:40px;line-height:1.4;">'
            'Reliable Vendors. Smarter Procurement.</div>'
            '</div>',
            unsafe_allow_html=True,
        )

        # ── User Info ─────────────────────────────────────────────────────────
        user_name = user.get("name", "User")
        user_initials = "".join(w[0].upper() for w in user_name.split()[:2])

        st.markdown(
            f'<div style="display:flex;align-items:center;gap:0.65rem;'
            f'padding:0.5rem 0.65rem;margin-bottom:0.75rem;'
            f'background:#1E2D42;border-radius:8px;border:1px solid #2A3548;">'
            f'<div style="width:32px;height:32px;border-radius:6px;'
            f'background:#B08D57;display:flex;align-items:center;'
            f'justify-content:center;font-weight:700;font-size:0.78rem;'
            f'color:white;flex-shrink:0;">{user_initials}</div>'
            f'<div style="overflow:hidden;flex:1;">'
            f'<div style="font-weight:600;font-size:0.82rem;color:#FFFFFF;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">{user_name}</div>'
            f'<div style="font-size:0.67rem;color:#B08D57;font-weight:500;">{role}</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        # ── Navigation Sections ───────────────────────────────────────────────
        sections = get_navigation_sections(role)
        unread_count = _get_unread_count_cached(str(user.get("_id", "")))

        for section in sections:
            if section["section"]:
                st.markdown(
                    f'<div style="font-size:0.62rem;font-weight:700;color:#526174;'
                    f'letter-spacing:1.2px;text-transform:uppercase;'
                    f'padding:0.55rem 0.5rem 0.2rem;margin-top:0.25rem;">'
                    f'{section["section"]}</div>',
                    unsafe_allow_html=True,
                )

            for item in section["items"]:
                page_key = item["key"]
                label = item["label"]
                icon_key = item.get("icon", "grid")
                is_active = current_page == page_key

                badge_html = ""
                if page_key == "notifications" and unread_count > 0:
                    badge_html = (
                        f'<span style="background:#B08D57;color:#FFFFFF;'
                        f'border-radius:10px;padding:1px 6px;font-size:0.65rem;'
                        f'font-weight:700;margin-left:auto;">{unread_count}</span>'
                    )

                clicked = st.button(
                    label,
                    key=f"nav_{page_key}",
                    help=f"Go to {label}",
                )
                if clicked:
                    navigate_to(page_key)
                    st.rerun()

        st.markdown("<div style='margin-top:0.8rem;border-top:1px solid #2A3548;padding-top:0.5rem;'></div>", unsafe_allow_html=True)

        if st.button("Sign Out", key="sidebar_logout_btn"):
            logout_user()
            navigate_to("landing")
            st.rerun()
