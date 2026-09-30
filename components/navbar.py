"""
components/navbar.py
--------------------
Top navigation bar component — enterprise navy & blue theme.
Features real-time dynamic greeting, role pill, and live ticking clock. Zero emoji.
"""

import streamlit as st
import streamlit.components.v1 as components
import html
from auth.session import get_current_user, get_current_role


from datetime import datetime

def render_dynamic_greeting(user: dict = None, role: str = None) -> None:
    """
    Render a dynamic greeting, role badge, and current system timestamp.
    Renders cleanly via native HTML/CSS without iframe index overhead.
    """
    if user is None:
        user = get_current_user() or {}
    if role is None:
        role = get_current_role() or "User"

    raw_name = user.get("name") or user.get("email", "User").split("@")[0].title()
    safe_name = html.escape(raw_name)
    safe_role = html.escape(role)

    now = datetime.now()
    hour = now.hour
    if 5 <= hour < 12:
        greeting = "Good morning"
    elif 12 <= hour < 17:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p")

    st.markdown(
        f"""
        <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #B08D57;
                    border-radius:10px;padding:0.75rem 1.25rem;display:flex;justify-content:space-between;
                    align-items:center;box-shadow:0 1px 3px rgba(23,32,51,0.05);min-height:64px;margin-bottom:0.75rem;">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:1.15rem;font-weight:700;color:#172033;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px;">
              <span>{greeting}</span>, <span>{safe_name}</span>
            </div>
            <div style="font-size:0.72rem;font-weight:600;color:#B08D57;background:#FEF8E7;border:1px solid #B08D5733;
                        border-radius:4px;padding:2px 8px;display:inline-flex;align-items:center;width:fit-content;">
              <span>{safe_role}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <div style="font-size:0.75rem;font-weight:500;color:#68707C;">{date_str}</div>
            <div style="font-size:1.15rem;font-weight:700;color:#172033;font-variant-numeric:tabular-nums;letter-spacing:0.5px;">{time_str}</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_page_header(title: str, subtitle: str = "") -> None:
    """Render a consistent page header with clean typography."""
    sub_html = ""
    if subtitle:
        sub_html = f'<p style="color:#526174;margin:0.25rem 0 0;font-size:0.875rem;">{subtitle}</p>'

    st.markdown(
        f'<div style="margin-bottom:1.1rem;margin-top:0.25rem;">'
        f'<h1 style="font-size:1.55rem;font-weight:800;color:#172033;'
        f'margin:0;padding:0;line-height:1.2;letter-spacing:-0.3px;">{title}</h1>'
        f'{sub_html}'
        f'</div>',
        unsafe_allow_html=True,
    )


def render_breadcrumb(*crumbs: str) -> None:
    """Render a breadcrumb navigation trail."""
    parts = " / ".join(crumbs)
    st.markdown(
        f'<div style="font-size:0.75rem;color:#7B8794;margin-bottom:0.4rem;font-weight:500;">{parts}</div>',
        unsafe_allow_html=True,
    )
