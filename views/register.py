"""
views/register.py
-----------------
Enterprise user registration page for VendorPulse.
Theme: Enterprise Navy (#061426), Blue (#1677E8), White (#FFFFFF). Zero emoji.
"""

import streamlit as st
from services.auth_service import register_user as svc_register
from services.vendor_service import get_vendors_for_select
from auth.session import navigate_to


def render_register_page() -> None:
    """Render the enterprise account registration page."""

    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        html, body, [class*="css"] {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .stApp {
            background: #F7F5F0 !important;
            min-height: 100vh;
        }

        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}

        .main .block-container {
            padding-top: 2.5rem !important;
            padding-bottom: 3rem !important;
            max-width: 720px !important;
            margin: 0 auto !important;
        }

        .vp-reg-card {
            background: #FFFFFF;
            border-radius: 14px;
            padding: 2.5rem 2.5rem;
            box-shadow: 0 6px 24px rgba(23, 32, 51, 0.07);
            border: 1px solid #D9D6CF;
        }

        .vp-reg-heading {
            font-size: 1.75rem;
            font-weight: 800;
            color: #172033;
            margin-bottom: 0.25rem;
            letter-spacing: -0.4px;
        }

        .vp-reg-sub {
            color: #68707C;
            font-size: 0.88rem;
            margin-bottom: 1.5rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    if st.button("← Back to Sign In", key="reg_back_login"):
        navigate_to("login")
        st.rerun()

    st.markdown("<div style='height: 0.5rem;'></div>", unsafe_allow_html=True)

    st.markdown(
        """
        <div class="vp-reg-card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;">
                <div style="width:34px;height:34px;background:#1677E8;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <span style="font-size:1.3rem;font-weight:800;color:#061426;">VendorPulse</span>
            </div>
            <div class="vp-reg-heading">Create Enterprise Account</div>
            <div class="vp-reg-sub">Register your credentials for role-based platform access</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.form("register_form"):
        col1, col2 = st.columns(2)
        with col1:
            name = st.text_input("Full Name *", placeholder="Jane Doe", key="reg_name")
            email = st.text_input("Work Email *", placeholder="jane@company.com", key="reg_email")
        with col2:
            role = st.selectbox(
                "Designated Role *",
                [
                    "Procurement Manager",
                    "Supply Chain Manager",
                    "Vendor Manager",
                    "Finance Officer",
                    "Auditor",
                    "Vendor",
                    "Administrator",
                ],
                key="reg_role",
            )
            department = st.text_input("Department", placeholder="e.g. Supply Operations", key="reg_dept")

        # Vendor-specific: link to vendor record for data isolation
        vendor_id_val = None
        vendor_category_val = None

        col3, col4 = st.columns(2)
        with col3:
            password = st.text_input("Password *", type="password", placeholder="Min 8 characters", key="reg_pw")
        with col4:
            confirm_pw = st.text_input("Confirm Password *", type="password", placeholder="Re-enter password", key="reg_cpw")

        terms = st.checkbox("I agree to the Enterprise Master Subscription Terms and Data Privacy Policy", key="reg_terms")

        submitted = st.form_submit_button("Complete Registration", type="primary", use_container_width=True)

    # Vendor linking info (outside form to allow dynamic content)
    if role == "Vendor":
        st.markdown(
            '<div style="background:#EAF1FC;border-left:3px solid #2E4B7A;border-radius:6px;'
            'padding:0.6rem 0.9rem;margin:0.4rem 0;font-size:0.83rem;color:#172033;">'
            '<b>Vendor Account Setup</b> — After registration, an Administrator must link this account '
            'to a vendor organization via the admin panel. Contact your system administrator.'
            '</div>',
            unsafe_allow_html=True,
        )

    if submitted:
        if not name.strip() or not email.strip() or not password.strip():
            st.error("Please complete all required fields (*).")
        elif password != confirm_pw:
            st.error("Passwords do not match.")
        elif len(password) < 8:
            st.error("Password must be at least 8 characters long.")
        elif not terms:
            st.error("You must agree to the Enterprise Terms to register.")
        else:
            success, message, _ = svc_register(
                name=name.strip(),
                email=email.strip().lower(),
                password=password,
                confirm_password=confirm_pw,
                role=role,
                department=department.strip(),
            )
            if success:
                st.success("Account registered successfully! Redirecting to sign in...")
                navigate_to("login")
                st.rerun()
            else:
                st.error(f"Registration failed: {message}")
