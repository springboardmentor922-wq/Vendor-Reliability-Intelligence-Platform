"""
views/login.py
--------------
Enterprise Sign In page for VendorPulse.
Deep Navy #172033 + Warm Ivory #F7F5F0 + Muted Gold #B08D57 design system.
True 100vw × 100vh viewport two-column layout.
All 6 roles Quick Demo Access in a 2-column grid. Clean checkmarks (no empty square boxes).
"""

import textwrap
import streamlit as st
from services.auth_service import login_user as svc_login
from auth.session import login_user as session_login, navigate_to


def render_login_page() -> None:
    """Render the enterprise Sign In page."""

    # ── Full Viewport Two-Column CSS via st.markdown ──────────────────────────
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        html, body, [class*="css"] {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* ── Strip all Streamlit headers, toolbars, and default margins ─────── */
        header,
        [data-testid="stHeader"],
        .stApp > header,
        [data-testid="stToolbar"],
        [data-testid="stDecoration"],
        [data-testid="stStatusWidget"],
        #MainMenu,
        footer {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: hidden !important;
        }

        /* ── Split 50/50 Viewport Background (Navy Left / Ivory Right) ──────── */
        .stApp {
            background: linear-gradient(to right, #172033 0%, #172033 50%, #F7F5F0 50%, #F7F5F0 100%) !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
        }

        [data-testid="stAppViewContainer"] {
            padding: 0 !important;
            margin: 0 !important;
            overflow-x: hidden !important;
        }

        [data-testid="stAppViewContainer"] > .main {
            padding: 0 !important;
            margin: 0 !important;
        }

        body .stApp .main .block-container,
        body .stApp [data-testid="stMainBlockContainer"],
        .main .block-container,
        [data-testid="stMainBlockContainer"] {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100vw !important;
            width: 100vw !important;
        }

        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"],
        .block-container > [data-testid="stVerticalBlock"] {
            gap: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        /* ── Back to Overview button (Fixed top-left, zero layout footprint) ─── */
        div[data-testid="stVerticalBlock"] > div:has(.vp-back-anchor) {
            position: fixed !important;
            top: 20px !important;
            left: 28px !important;
            z-index: 999999 !important;
            height: 0 !important;
            width: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        div[data-testid="stVerticalBlock"] > div:has(.vp-back-anchor) button {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            background: rgba(255, 255, 255, 0.08) !important;
            color: #CBD5E1 !important;
            border: 1px solid rgba(255, 255, 255, 0.22) !important;
            border-radius: 6px !important;
            padding: 4px 12px !important;
            font-size: 0.8rem !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            height: 30px !important;
            min-height: 30px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            box-shadow: none !important;
            transition: all 0.15s ease !important;
        }

        div[data-testid="stVerticalBlock"] > div:has(.vp-back-anchor) button:hover {
            background: rgba(255, 255, 255, 0.16) !important;
            color: #FFFFFF !important;
            border-color: #B08D57 !important;
        }

        /* ── Viewport Two-Column Layout (ONLY the top-level main block) ──────── */
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] {
            display: grid !important;
            grid-template-columns: 50vw 50vw !important;
            min-height: 100vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            box-sizing: border-box !important;
        }

        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"],
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {
            width: 50vw !important;
            max-width: 50vw !important;
            min-width: 0 !important;
            flex: none !important;
        }

        /* ── LEFT COLUMN: Guaranteed Deep Navy #172033 ──────────────────────── */
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child {
            background: #172033 !important;
            min-height: 100vh !important;
            width: 50vw !important;
            max-width: 50vw !important;
            padding: clamp(2.5rem, 5vh, 4.5rem) clamp(2.5rem, 4.5vw, 4.5rem) !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
        }

        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child > [data-testid="stVerticalBlock"],
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child > [data-testid="stVerticalBlock"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child > [data-testid="stVerticalBlock"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child > [data-testid="stVerticalBlock"] {
            padding: 0 !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: 520px !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 0 !important;
        }

        .vp-brand-wrapper {
            max-width: 520px;
            width: 100%;
            margin: 0 auto;
            padding: 0.5rem 0;
            box-sizing: border-box;
            text-align: left;
        }

        .vp-brand-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 0;
            margin-bottom: clamp(0.75rem, 1.8vh, 1.4rem);
        }
        .vp-brand-name {
            font-size: 1.45rem;
            font-weight: 800;
            color: #FFFFFF !important;
            letter-spacing: -0.4px;
        }
        .vp-brand-tag {
            color: #B08D57 !important;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.3px;
            background: rgba(176,141,87,0.15);
            border: 1px solid rgba(176,141,87,0.35);
            border-radius: 5px;
            padding: 2px 8px;
        }
        .vp-brand-tagline {
            color: #B08D57 !important;
            font-size: 0.92rem;
            font-weight: 600;
            margin-bottom: 0.35rem;
            letter-spacing: 0.2px;
        }
        .vp-brand-headline {
            color: #FFFFFF !important;
            font-size: clamp(1.4rem, 2vw, 1.85rem);
            font-weight: 800;
            letter-spacing: -0.5px;
            line-height: 1.22;
            margin-bottom: 0.55rem;
        }
        .vp-brand-sub {
            color: #CBD5E1 !important;
            font-size: 0.85rem;
            line-height: 1.55;
            margin-bottom: clamp(1rem, 2vh, 1.6rem);
        }

        /* Feature Cards — Clean, no empty square boxes */
        .vp-feat-card {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            background: #1E2D42 !important;
            border: 1px solid #2E3D56 !important;
            border-radius: 10px;
            padding: clamp(0.65rem, 1.2vh, 0.85rem) 1rem;
            margin-bottom: clamp(0.45rem, 1vh, 0.65rem);
        }
        .vp-feat-check {
            color: #B08D57;
            font-size: 1rem;
            font-weight: 700;
            line-height: 1.3;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .vp-feat-card-title {
            color: #FFFFFF !important;
            font-weight: 600;
            font-size: 0.86rem;
            margin-bottom: 2px;
        }
        .vp-feat-card-sub {
            color: #CBD5E1 !important;
            font-size: 0.77rem;
            line-height: 1.4;
        }
        .vp-brand-footer {
            color: #94A3B8 !important;
            font-size: 0.74rem;
            border-top: 1px solid #25334A;
            padding-top: 0.8rem;
            margin-top: clamp(0.75rem, 1.5vh, 1.3rem);
            letter-spacing: 0.2px;
        }
        .vp-brand-footer span {
            color: #B08D57;
            font-weight: 600;
        }

        /* ── RIGHT COLUMN: Warm Ivory #F7F5F0 + Vertically Centered Card ─────── */
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child,
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child {
            background: #F7F5F0 !important;
            min-height: 100vh !important;
            width: 50vw !important;
            max-width: 50vw !important;
            padding: clamp(1rem, 2.5vh, 2rem) clamp(1rem, 2.5vw, 2.5rem) !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
        }

        /* Centered White Login Card */
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child > [data-testid="stVerticalBlock"],
        [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child > [data-testid="stVerticalBlock"],
        .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"] {
            width: min(92%, 500px) !important;
            max-width: 500px !important;
            background: #FFFFFF !important;
            border: 1px solid #D9D6CF !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 24px rgba(23, 32, 51, 0.07), 0 1px 3px rgba(23, 32, 51, 0.04) !important;
            padding: clamp(1.4rem, 2.8vh, 2rem) clamp(1.3rem, 2.2vw, 2rem) !important;
            box-sizing: border-box !important;
            gap: 0.45rem !important;
            margin: auto 0 !important;
        }

        /* Remove default borders and padding on Streamlit form */
        [data-testid="column"]:last-child [data-testid="stForm"],
        [data-testid="stColumn"]:last-child [data-testid="stForm"] {
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
        }

        /* Form input typography and styling */
        .stTextInput > label {
            font-size: 0.82rem !important;
            font-weight: 600 !important;
            color: #172033 !important;
            margin-bottom: 2px !important;
        }
        .stTextInput > div > div > input {
            border-radius: 7px !important;
            border: 1.5px solid #D9D6CF !important;
            padding: 0.45rem 0.8rem !important;
            font-size: 0.88rem !important;
            background: #FFFFFF !important;
            color: #172033 !important;
            height: 40px !important;
            min-height: 40px !important;
        }
        .stTextInput > div > div > input:focus {
            border-color: #B08D57 !important;
            box-shadow: 0 0 0 3px rgba(176,141,87,0.15) !important;
        }

        /* Sign In Submit Button */
        .stForm .stButton > button,
        .stForm [data-testid="stBaseButton-primaryFormSubmit"] {
            background: #172033 !important;
            color: #FFFFFF !important;
            border: none !important;
            border-radius: 7px !important;
            font-weight: 600 !important;
            font-size: 0.95rem !important;
            height: 44px !important;
            min-height: 44px !important;
            box-shadow: 0 2px 8px rgba(23,32,51,0.2) !important;
            transition: all 0.15s ease !important;
        }
        .stForm .stButton > button:hover,
        .stForm [data-testid="stBaseButton-primaryFormSubmit"]:hover {
            background: #25334A !important;
            box-shadow: 0 4px 12px rgba(23,32,51,0.3) !important;
        }

        /* Create Account Button inside card */
        [data-testid="column"]:last-child > [data-testid="stVerticalBlock"] > div.stButton > button,
        [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"] > div.stButton > button {
            background: #FFFFFF !important;
            color: #172033 !important;
            border: 1.5px solid #172033 !important;
            border-radius: 7px !important;
            font-weight: 600 !important;
            font-size: 0.86rem !important;
            height: 38px !important;
            min-height: 38px !important;
            transition: all 0.15s ease !important;
        }
        [data-testid="column"]:last-child > [data-testid="stVerticalBlock"] > div.stButton > button:hover,
        [data-testid="stColumn"]:last-child > [data-testid="stVerticalBlock"] > div.stButton > button:hover {
            background: #F7F5F0 !important;
            border-color: #3E4A61 !important;
        }

        /* Quick Demo Access Header */
        .vp-demo-hdr {
            margin-top: 0.65rem;
            padding-top: 0.55rem;
            border-top: 1px solid #E5E2DC;
            text-align: center;
        }
        .vp-demo-title {
            font-size: 0.85rem;
            font-weight: 700;
            color: #172033;
            letter-spacing: -0.2px;
        }
        .vp-demo-sub {
            font-size: 0.72rem;
            color: #68707C;
            margin-top: 1px;
            margin-bottom: 0.4rem;
        }

        /* ── Inner Demo Columns: 2-Column Grid inside card ─────────────────── */
        [data-testid="column"]:last-child [data-testid="stHorizontalBlock"],
        [data-testid="stColumn"]:last-child [data-testid="stHorizontalBlock"] {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            gap: 8px !important;
            margin: 0.2rem 0 !important;
            padding: 0 !important;
        }

        [data-testid="column"]:last-child [data-testid="stHorizontalBlock"] > [data-testid="column"],
        [data-testid="column"]:last-child [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
        [data-testid="stColumn"]:last-child [data-testid="stHorizontalBlock"] > [data-testid="column"],
        [data-testid="stColumn"]:last-child [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            flex: 1 1 0% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
        }

        /* Demo Buttons inside card */
        [data-testid="column"]:last-child [data-testid="stHorizontalBlock"] .stButton > button,
        [data-testid="stColumn"]:last-child [data-testid="stHorizontalBlock"] .stButton > button {
            background: #FFFFFF !important;
            color: #172033 !important;
            border: 1px solid #D9D6CF !important;
            border-radius: 6px !important;
            font-size: 0.76rem !important;
            font-weight: 600 !important;
            height: 36px !important;
            min-height: 36px !important;
            padding: 0.2rem 0.4rem !important;
            box-shadow: 0 1px 2px rgba(23, 32, 51, 0.04) !important;
            transition: all 0.15s ease !important;
            white-space: nowrap !important;
            width: 100% !important;
        }
        [data-testid="column"]:last-child [data-testid="stHorizontalBlock"] .stButton > button:hover,
        [data-testid="stColumn"]:last-child [data-testid="stHorizontalBlock"] .stButton > button:hover {
            background: #F7F5F0 !important;
            border-color: #B08D57 !important;
            color: #172033 !important;
            box-shadow: 0 2px 6px rgba(176, 141, 87, 0.18) !important;
            transform: translateY(-1px) !important;
        }

        /* ── Responsive Behavior ────────────────────────────────────────────── */
        @media (max-width: 992px) {
            .stApp {
                background: #F7F5F0 !important;
            }
            [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"],
            .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] {
                display: flex !important;
                flex-direction: column !important;
                min-height: auto !important;
            }
            [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
            [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child,
            .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:first-child,
            .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child {
                min-height: auto !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 3.5rem 1.5rem 2rem !important;
            }
            [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
            [data-testid="stMainBlockContainer"] > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child,
            .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="column"]:last-child,
            .block-container > [data-testid="stVerticalBlock"] > [data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:last-child {
                min-height: auto !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 2rem 1rem 3rem !important;
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    # ── Top-Left Back Button (out-of-flow fixed position) ───────────────────────
    with st.container():
        st.markdown('<div class="vp-back-anchor"></div>', unsafe_allow_html=True)
        if st.button("← Back to Overview", key="back_to_landing"):
            navigate_to("landing")
            st.rerun()

    # ── Two-Column 50vw / 50vw Viewport Layout ────────────────────────────────
    col_brand, col_form = st.columns([1, 1], gap="small")

    # ── LEFT: Deep Navy Branding Panel (No empty squares) ──────────────────────
    with col_brand:
        st.markdown(
            textwrap.dedent(
                """<div class="vp-brand-wrapper">
<div class="vp-brand-logo">
<span class="vp-brand-name">VendorPulse</span>
<span class="vp-brand-tag">v2.0</span>
</div>
<div class="vp-brand-tagline">Smarter Vendors. Stronger Business.</div>
<div class="vp-brand-headline">
Empowering Procurement<br>Through Intelligence
</div>
<div class="vp-brand-sub">
One unified platform for vendor management, procurement workflows,
purchase orders, contract oversight, and real-time supplier risk intelligence.
</div>
<div class="vp-feat-card">
<div class="vp-feat-check">&#10003;</div>
<div>
<div class="vp-feat-card-title">Vendor Intelligence</div>
<div class="vp-feat-card-sub">24,000+ active supplier profiles with live reliability scoring, disruption tracking, and automated qualification.</div>
</div>
</div>
<div class="vp-feat-card">
<div class="vp-feat-check">&#10003;</div>
<div>
<div class="vp-feat-card-title">Procurement Management</div>
<div class="vp-feat-card-sub">Automated approval routing, purchase orders, and contract management across multi-level authorization.</div>
</div>
</div>
<div class="vp-feat-card">
<div class="vp-feat-check">&#10003;</div>
<div>
<div class="vp-feat-card-title">Risk &amp; Compliance</div>
<div class="vp-feat-card-sub">Risk scoring, compliance monitoring, contract oversight, and audit-ready visibility.</div>
</div>
</div>
<div class="vp-brand-footer">
Enterprise-grade procurement intelligence &bull; <span>SECURE</span> &bull; <span>SCALABLE</span> &bull; <span>INTELLIGENT</span>
</div>
</div>"""
            ),
            unsafe_allow_html=True,
        )

    # ── RIGHT: Centered Login Card ─────────────────────────────────────────────
    with col_form:
        st.markdown(
            """
            <div style="margin-bottom: 0.65rem;">
                <div style="font-size: 1.55rem; font-weight: 800; color: #172033; letter-spacing: -0.5px; line-height: 1.2;">Welcome back</div>
                <div style="color: #68707C; font-size: 0.85rem; margin-top: 2px;">Sign in to your VendorPulse workspace</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        with st.form("login_form", clear_on_submit=False):
            email = st.text_input(
                "Email Address",
                placeholder="Enter your email address",
                key="login_email",
            )
            password = st.text_input(
                "Password",
                type="password",
                placeholder="Enter your password",
                key="login_password",
            )
            st.markdown(
                '<div style="text-align: right; font-size: 0.8rem; color: #B08D57; font-weight: 500; cursor: pointer; margin-top: -0.25rem; margin-bottom: 0.5rem;">Forgot Password?</div>',
                unsafe_allow_html=True,
            )
            submitted = st.form_submit_button(
                "Sign In to Workspace",
                type="primary",
                use_container_width=True,
            )

        if submitted:
            if not email.strip() or not password.strip():
                st.error("Please enter both email and password.")
            else:
                ok, msg, token, user_dict = svc_login(email.strip(), password.strip())
                if ok:
                    session_login(token, user_dict)
                    st.success("Authentication successful. Loading workspace...")
                    navigate_to("dashboard")
                    st.rerun()
                else:
                    st.error(f"Sign-in failed: {msg}")

        # Divider
        st.markdown(
            """
            <div style="display: flex; align-items: center; gap: 0.6rem; margin: 0.45rem 0 0.15rem;">
                <div style="flex: 1; height: 1px; background: #E5E2DC;"></div>
                <div style="font-size: 0.76rem; color: #8C93A0; font-weight: 500; white-space: nowrap;">Don't have an account?</div>
                <div style="flex: 1; height: 1px; background: #E5E2DC;"></div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Create New Account button
        if st.button("Create New Account", key="go_register", use_container_width=True):
            navigate_to("register")
            st.rerun()

        # ── Quick Demo Access (All 6 Roles in 2-Column Grid) ─────────────────
        st.markdown(
            """
            <div class="vp-demo-hdr">
                <div class="vp-demo-title">Quick Demo Access</div>
                <div class="vp-demo-sub">Sign in instantly with a predefined role</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # ── Quick Demo Roles — 2-col, 3-row explicit layout ──────────────────
        # Streamlit renders st.columns() left-to-right within each row call.
        # Using explicit per-row calls guarantees the visible order.
        #
        # Row 1: Administrator        | Procurement Manager
        # Row 2: Supply Chain Manager | Vendor Manager
        # Row 3: Finance Officer      | Auditor

        def _demo_login(email: str, pwd: str) -> None:
            ok, msg, token, u = svc_login(email, pwd)
            if ok:
                session_login(token, u)
                navigate_to("dashboard")
                st.rerun()

        # Row 1
        r1a, r1b = st.columns(2, gap="small")
        with r1a:
            if st.button("Administrator", key="demo_admin", use_container_width=True):
                _demo_login("admin@vendorpulse.com", "admin123")
        with r1b:
            if st.button("Procurement Manager", key="demo_procure", use_container_width=True):
                _demo_login("procurement@vendorpulse.com", "procure123")

        # Row 2
        r2a, r2b = st.columns(2, gap="small")
        with r2a:
            if st.button("Supply Chain Manager", key="demo_supply", use_container_width=True):
                _demo_login("supply@vendorpulse.com", "supply123")
        with r2b:
            if st.button("Vendor Manager", key="demo_vendor_mgr", use_container_width=True):
                _demo_login("vendormanager@vendorpulse.com", "Vendor@123")

        # Row 3
        r3a, r3b = st.columns(2, gap="small")
        with r3a:
            if st.button("Finance Officer", key="demo_finance", use_container_width=True):
                _demo_login("finance@vendorpulse.com", "finance123")
        with r3b:
            if st.button("Auditor", key="demo_auditor", use_container_width=True):
                _demo_login("auditor@vendorpulse.com", "audit123")



        # Security indicators
        st.markdown(
            """
            <div style="display: flex; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.45rem; justify-content: center;">
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; color: #526174; background: #F7F5F0; border: 1px solid #D9D6CF; border-radius: 4px; padding: 2px 7px;">
                    <span style="width: 5px; height: 5px; background: #2D6A4A; border-radius: 50%; display: inline-block;"></span> JWT Secured
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; color: #526174; background: #F7F5F0; border: 1px solid #D9D6CF; border-radius: 4px; padding: 2px 7px;">
                    <span style="width: 5px; height: 5px; background: #2D6A4A; border-radius: 50%; display: inline-block;"></span> Role-Based Access
                </span>
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; color: #526174; background: #F7F5F0; border: 1px solid #D9D6CF; border-radius: 4px; padding: 2px 7px;">
                    <span style="width: 5px; height: 5px; background: #2D6A4A; border-radius: 50%; display: inline-block;"></span> Enterprise Ready
                </span>
            </div>
            """,
            unsafe_allow_html=True,
        )


