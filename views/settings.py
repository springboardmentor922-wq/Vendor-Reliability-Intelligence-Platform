"""
views/settings.py
-----------------
Enterprise Platform Settings & System Configuration.
Theme: Enterprise Navy (#061426) & Blue (#1677E8). Zero emoji.
"""

import streamlit as st
import socket
from components.navbar import render_page_header
from components.cards import render_section_header
from config.settings import MONGODB_DATABASE, APP_VERSION


def render_settings_page() -> None:
    """Render the Settings page."""
    render_page_header("System Settings", "Configure application parameters, inspect API gateway status, and manage session policies.")

    render_section_header("System Architecture & Gateway Telemetry")

    # Check FastAPI on port 8000
    fastapi_live = False
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            fastapi_live = s.connect_ex(('127.0.0.1', 8000)) == 0
    except Exception:
        fastapi_live = False

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(
            f"""
            <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #1677E8;border-radius:10px;padding:1rem;">
                <div style="font-size:0.7rem;font-weight:700;color:#7B8794;text-transform:uppercase;">Platform Version</div>
                <div style="font-size:1.4rem;font-weight:800;color:#0B1B33;margin-top:2px;">v{APP_VERSION} Enterprise</div>
                <div style="font-size:0.72rem;color:#526174;margin-top:2px;">Milestone 2 Release</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with c2:
        api_color = "#22A06B" if fastapi_live else "#D64545"
        api_status = "Online (Port 8000)" if fastapi_live else "Offline / Direct Fallback"
        st.markdown(
            f"""
            <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid {api_color};border-radius:10px;padding:1rem;">
                <div style="font-size:0.7rem;font-weight:700;color:#7B8794;text-transform:uppercase;">FastAPI Backend</div>
                <div style="font-size:1.4rem;font-weight:800;color:{api_color};margin-top:2px;">{api_status}</div>
                <div style="font-size:0.72rem;color:#526174;margin-top:2px;">REST API Gateway</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with c3:
        st.markdown(
            f"""
            <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #22A06B;border-radius:10px;padding:1rem;">
                <div style="font-size:0.7rem;font-weight:700;color:#7B8794;text-transform:uppercase;">Primary Database</div>
                <div style="font-size:1.4rem;font-weight:800;color:#0B1B33;margin-top:2px;">MongoDB</div>
                <div style="font-size:0.72rem;color:#22A06B;margin-top:2px;">Database: {MONGODB_DATABASE}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)

    render_section_header("Security & Session Governance")
    st.markdown(
        """
        <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:1.25rem;">
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #E2E8F0;">
                <span style="font-weight:600;color:#0B1B33;font-size:0.9rem;">Authentication Protocol</span>
                <span style="color:#526174;font-size:0.85rem;">JWT (HMAC-SHA256, 8-hour expiration)</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #E2E8F0;">
                <span style="font-weight:600;color:#0B1B33;font-size:0.9rem;">Password Hashing Standard</span>
                <span style="color:#526174;font-size:0.85rem;">Bcrypt (cost factor 12)</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #E2E8F0;">
                <span style="font-weight:600;color:#0B1B33;font-size:0.9rem;">Authorization Framework</span>
                <span style="color:#526174;font-size:0.85rem;">6 Enterprise Roles (RBAC enforced)</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
                <span style="font-weight:600;color:#0B1B33;font-size:0.9rem;">Audit Logging Target</span>
                <span style="color:#526174;font-size:0.85rem;">MongoDB 'audit_logs' collection</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
