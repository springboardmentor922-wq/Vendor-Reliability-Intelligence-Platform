"""
views/profile.py
----------------
Enterprise User Profile & Credentials page.
Theme: Enterprise Navy (#061426) & Blue (#1677E8). Zero emoji.
"""

import streamlit as st
from components.navbar import render_page_header
from components.cards import render_section_header
from auth.session import get_current_user, get_current_role
from services.auth_service import update_user_profile
from utils.helpers import format_datetime


def render_profile_page() -> None:
    """Render the User Profile page."""
    render_page_header("Account Profile", "Manage your enterprise identity, credentials, and authorization details.")

    user = get_current_user()
    role = get_current_role()

    if not user:
        st.error("Could not load profile. Please log in again.")
        return

    user_id = user.get("_id", "")

    name = user.get("name", "User")
    email = user.get("email", "")
    initials = "".join(w[0].upper() for w in name.split()[:2])

    st.markdown(
        f"""
        <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="width:64px;height:64px;border-radius:10px;background:#1677E8;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:white;flex-shrink:0;">
                {initials}
            </div>
            <div>
                <div style="font-size:1.35rem;font-weight:800;color:#0B1B33;letter-spacing:-0.3px;">{name}</div>
                <div style="font-size:0.85rem;color:#526174;margin-top:2px;">{email}</div>
                <div style="margin-top:6px;display:flex;gap:8px;">
                    <span style="background:#EAF3FF;color:#1677E8;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:4px;">{role}</span>
                    <span style="background:#EAF8F1;color:#22A06B;font-size:0.75rem;font-weight:600;padding:2px 8px;border-radius:4px;">Verified Active</span>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    render_section_header("Edit Profile Details")

    with st.form("profile_edit_form"):
        col1, col2 = st.columns(2)
        with col1:
            new_name = st.text_input("Full Name", value=name, key="prof_name")
            st.text_input("Email Address (Immutable)", value=email, disabled=True, key="prof_email")
        with col2:
            dept = st.text_input("Department", value=user.get("department", "Procurement"), key="prof_dept")
            phone = st.text_input("Contact Phone", value=user.get("phone", ""), key="prof_phone")

        submit = st.form_submit_button("Save Profile Changes", type="primary")
        if submit:
            if not new_name.strip():
                st.error("Name cannot be blank.")
            else:
                ok, msg = update_user_profile(
                    user_id=user_id,
                    name=new_name.strip(),
                    department=dept.strip(),
                    phone=phone.strip(),
                )
                if ok:
                    st.success(msg)
                    st.rerun()
                else:
                    st.error(msg)
