"""
views/landing.py
----------------
Public marketing landing page for VendorPulse.
Uses the SAME Deep Navy #172033 + Warm Ivory #F7F5F0 + Muted Gold #B08D57 design system
as the authenticated application. Zero emoji. No neon. No glassmorphism.
Full responsive desktop width layout (max-width: 1560px, 94% viewport).
"""

import streamlit as st
from auth.session import navigate_to
from services.vendor_service import get_vendor_stats


def render_landing_page() -> None:
    """Render the public marketing landing page."""
    stats = get_vendor_stats()
    total_vendors = stats.get("total", 24117)
    active_vendors = stats.get("active", 22180)
    avg_rel = stats.get("avg_reliability", 88.4)

    # ── Inline CSS — Enterprise SaaS Scale & Width ─────────────────────────────
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        html, body, [class*="css"] {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* Warm ivory background */
        .stApp {
            background: #F7F5F0 !important;
        }
        header,
        [data-testid="stHeader"],
        .stApp > header,
        [data-testid="stToolbar"],
        #MainMenu,
        footer {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            visibility: hidden !important;
        }

        /* Wide responsive container — fills viewport naturally */
        .main .block-container {
            padding: 0.5rem min(2.5rem, 3vw) 3rem !important;
            max-width: min(1600px, 94vw) !important;
            width: min(94%, 1600px) !important;
            margin: 0 auto !important;
        }
        [data-testid="stAppViewBlockContainer"] {
            max-width: min(1600px, 94vw) !important;
            width: min(94%, 1600px) !important;
            padding-left: min(2.5rem, 3vw) !important;
            padding-right: min(2.5rem, 3vw) !important;
            margin: 0 auto !important;
        }

        /* ── Global Buttons Styling ───────────────────────────── */
        .stButton > button[kind="primary"],
        .stButton > button[data-testid="stBaseButton-primary"],
        button[kind="primary"] {
            background-color: #B08D57 !important;
            color: #FFFFFF !important;
            border: 1px solid #9D7B48 !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            font-size: 1rem !important;
            min-height: 50px !important;
            height: 50px !important;
            padding: 0.65rem 1.75rem !important;
            box-shadow: 0 2px 10px rgba(176,141,87,0.28) !important;
            transition: all 0.15s ease !important;
            cursor: pointer !important;
        }
        .stButton > button[kind="primary"]:hover,
        button[kind="primary"]:hover {
            background-color: #9D7B48 !important;
            border-color: #8C6C3B !important;
            box-shadow: 0 4px 14px rgba(176,141,87,0.4) !important;
            transform: translateY(-1px) !important;
        }
        .stButton > button[kind="secondary"],
        .stButton > button[data-testid="stBaseButton-secondary"],
        button[kind="secondary"] {
            background-color: #FFFFFF !important;
            color: #172033 !important;
            border: 1.5px solid #172033 !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            font-size: 1rem !important;
            min-height: 50px !important;
            height: 50px !important;
            padding: 0.65rem 1.75rem !important;
            transition: all 0.15s ease !important;
            cursor: pointer !important;
        }
        .stButton > button[kind="secondary"]:hover,
        button[kind="secondary"]:hover {
            background-color: #F7F5F0 !important;
            border-color: #3E4A61 !important;
            color: #172033 !important;
            transform: translateY(-1px) !important;
        }

        /* ── Navbar ─────────────────────────────────────────── */
        .lp-nav {
            background: #172033;
            min-height: 68px;
            padding: 0.9rem 2.2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 0 0 14px 14px;
            margin-bottom: 2.5rem;
            box-shadow: 0 4px 20px rgba(23,32,51,0.12);
            width: 100%;
        }
        .lp-nav-left {
            display: flex;
            align-items: center;
            gap: 2.5rem;
        }
        .lp-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.3rem;
            font-weight: 800;
            color: #FFFFFF;
            letter-spacing: -0.4px;
        }
        .lp-logo-icon {
            width: 36px; height: 36px;
            border-radius: 8px;
            background: #B08D57;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 10px rgba(176,141,87,0.35);
        }
        .lp-nav-links {
            display: flex;
            gap: 2.2rem;
            align-items: center;
        }
        .lp-nav-link {
            color: rgba(255,255,255,0.72);
            font-size: 0.95rem;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.15s;
        }
        .lp-nav-link:hover { color: #FFFFFF; }
        .lp-nav-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .lp-nav-tag {
            font-size: 0.78rem;
            color: #B08D57;
            background: rgba(176,141,87,0.14);
            border: 1px solid rgba(176,141,87,0.32);
            border-radius: 6px;
            padding: 4px 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }

        /* ── Hero Section ───────────────────────────────────── */
        .lp-hero-wrap {
            padding: clamp(1.5rem, 3vh, 3rem) 0 clamp(1.5rem, 3vh, 2.5rem);
            min-height: clamp(420px, 58vh, 620px);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .lp-label {
            font-size: clamp(0.65rem, 0.7vw, 0.8rem);
            font-weight: 700;
            color: #B08D57;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            margin-bottom: 0.85rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .lp-label::before {
            content: '';
            display: inline-block;
            width: 20px; height: 2px;
            background: #B08D57;
            border-radius: 2px;
        }
        .lp-h1 {
            font-size: clamp(2.1rem, 3vw, 3.4rem);
            font-weight: 800;
            color: #172033;
            line-height: 1.15;
            letter-spacing: -0.8px;
            margin: 0 0 1rem;
        }
        .lp-sub {
            font-size: clamp(0.95rem, 1.1vw, 1.15rem);
            color: #526174;
            line-height: 1.7;
            max-width: 520px;
            margin-bottom: 1.75rem;
        }
        .lp-hero-trust {
            display: flex;
            align-items: center;
            gap: 1.2rem;
            margin-top: 1.75rem;
            font-size: 0.82rem;
            color: #68707C;
            font-weight: 500;
        }
        .lp-hero-trust span.badge {
            color: #2D6A4A;
            font-weight: 600;
        }

        /* ── Dashboard Preview Card ─────────────────────────── */
        .lp-preview {
            background: #FFFFFF;
            border: 1px solid #D9D6CF;
            border-radius: 14px;
            padding: clamp(1.4rem, 2vw, 2.2rem);
            box-shadow: 0 8px 32px rgba(23,32,51,0.08);
            border-top: 4px solid #B08D57;
            min-height: clamp(380px, 52vh, 580px);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .lp-preview-hdr {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.4rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #EBE9E4;
        }
        .lp-preview-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: #172033;
            letter-spacing: -0.3px;
        }
        .lp-live {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #2D6A4A;
            background: rgba(45,106,74,0.08);
            padding: 3px 10px;
            border-radius: 20px;
        }
        .lp-live-dot {
            width: 7px; height: 7px;
            background: #2D6A4A;
            border-radius: 50%;
        }
        .lp-preview-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin-bottom: 1.25rem;
        }
        .lp-stat-mini {
            background: #F7F5F0;
            border: 1px solid #EBE9E4;
            border-radius: 10px;
            padding: 1.1rem 1.25rem;
        }
        .lp-stat-lbl {
            font-size: 0.72rem;
            font-weight: 700;
            color: #68707C;
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }
        .lp-stat-val {
            font-size: clamp(1.35rem, 2vw, 1.85rem);
            font-weight: 800;
            color: #172033;
            margin: 3px 0 2px;
            letter-spacing: -0.5px;
        }
        .lp-stat-sub {
            font-size: 0.75rem;
            color: #2D6A4A;
            font-weight: 600;
        }

        .lp-risk-panel {
            background: #F7F5F0;
            border: 1px solid #EBE9E4;
            border-radius: 10px;
            padding: 1.1rem 1.25rem;
            margin-bottom: 0.75rem;
        }
        .lp-risk-hdr {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        .lp-risk-title {
            font-size: 0.88rem;
            font-weight: 700;
            color: #172033;
        }
        .lp-risk-sub {
            font-size: 0.76rem;
            color: #68707C;
            font-weight: 500;
        }
        .lp-risk-bar {
            display: flex;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            gap: 2px;
            margin-bottom: 0.65rem;
        }
        .lp-risk-legend {
            display: flex;
            justify-content: space-between;
            font-size: 0.76rem;
            color: #526174;
            font-weight: 600;
        }
        .lp-preview-foot {
            font-size: 0.78rem;
            color: #68707C;
            text-align: center;
            border-top: 1px solid #EBE9E4;
            padding-top: 0.9rem;
            margin-top: 0.5rem;
        }

        /* ── Section Headers ─────────────────────────────────── */
        .lp-sec-wrap {
            text-align: center;
            margin-bottom: 2rem;
            width: 100%;
        }
        .lp-sec-label {
            font-size: 0.72rem;
            font-weight: 700;
            color: #B08D57;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }
        .lp-sec-h2 {
            font-size: clamp(1.6rem, 2.2vw, 2.2rem);
            font-weight: 800;
            color: #172033;
            letter-spacing: -0.5px;
            margin: 0 0 0.6rem;
        }
        .lp-sec-sub {
            font-size: clamp(0.88rem, 1vw, 1.05rem);
            color: #526174;
            line-height: 1.65;
            max-width: 580px;
            margin: 0 auto;
        }

        /* ── Platform Capabilities Grid (6 Cards Desktop) ─────── */
        .lp-feat-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 1.25rem;
            width: 100%;
        }
        @media (max-width: 1300px) {
            .lp-feat-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        @media (max-width: 768px) {
            .lp-feat-grid {
                grid-template-columns: 1fr;
            }
        }

        .lp-feat {
            background: #FFFFFF;
            border: 1px solid #D9D6CF;
            border-radius: 12px;
            padding: clamp(1.2rem, 1.6vw, 1.8rem) clamp(1rem, 1.2vw, 1.4rem);
            box-shadow: 0 2px 10px rgba(23,32,51,0.05);
            transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            min-height: clamp(180px, 20vw, 240px);
            height: 100%;
        }
        .lp-feat:hover {
            box-shadow: 0 6px 20px rgba(23,32,51,0.11);
            transform: translateY(-2px);
            border-color: #B08D57;
        }
        .lp-feat-icon {
            width: 44px; height: 44px;
            background: #FEF8E7;
            border: 1px solid rgba(176,141,87,0.25);
            border-radius: 9px;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 1rem;
            flex-shrink: 0;
        }
        .lp-feat-title {
            font-size: clamp(0.88rem, 0.95vw, 1.05rem);
            font-weight: 700;
            color: #172033;
            margin-bottom: 0.5rem;
            letter-spacing: -0.2px;
        }
        .lp-feat-desc {
            font-size: clamp(0.76rem, 0.82vw, 0.88rem);
            color: #526174;
            line-height: 1.6;
        }

        /* ── Workflow ────────────────────────────────────────── */
        .lp-workflow-wrap {
            background: #FFFFFF;
            border: 1px solid #D9D6CF;
            border-radius: 14px;
            padding: 2.75rem 2.2rem;
            box-shadow: 0 4px 20px rgba(23,32,51,0.06);
            width: 100%;
        }
        .lp-step-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .lp-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            flex: 1;
            min-width: 110px;
        }
        .lp-step-icon {
            width: 58px; height: 58px;
            background: #F7F5F0;
            border: 1.5px solid #D9D6CF;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 0.85rem;
            transition: all 0.2s ease;
        }
        .lp-step-icon-active {
            width: 58px; height: 58px;
            background: #172033;
            border: 1.5px solid #172033;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 0.85rem;
            box-shadow: 0 4px 14px rgba(23,32,51,0.25);
        }
        .lp-step-num {
            font-size: 0.68rem;
            font-weight: 700;
            color: #B08D57;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 0.35rem;
        }
        .lp-step-lbl {
            font-size: 0.92rem;
            font-weight: 700;
            color: #172033;
            line-height: 1.35;
        }
        .lp-step-arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #B08D57;
            flex-shrink: 0;
            padding: 0 0.5rem;
            margin-bottom: 1.8rem;
        }

        /* ── Role-Based Access Grid (6 Cards Desktop) ────────── */
        .lp-role-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 1.25rem;
            width: 100%;
        }
        @media (max-width: 1300px) {
            .lp-role-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        @media (max-width: 768px) {
            .lp-role-grid {
                grid-template-columns: 1fr;
            }
        }

        .lp-role {
            background: #FFFFFF;
            border: 1px solid #D9D6CF;
            border-radius: 12px;
            padding: 1.8rem 1.2rem;
            box-shadow: 0 2px 10px rgba(23,32,51,0.05);
            transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            min-height: 250px;
        }
        .lp-role:hover {
            box-shadow: 0 8px 24px rgba(23,32,51,0.12);
            transform: translateY(-3px);
            border-color: #B08D57;
        }
        .lp-role-avatar {
            width: 52px; height: 52px;
            border-radius: 50%;
            background: #172033;
            display: flex; align-items: center; justify-content: center;
            margin-bottom: 0.9rem;
        }
        .lp-role-name {
            font-size: 1.05rem;
            font-weight: 700;
            color: #172033;
            margin-bottom: 0.45rem;
        }
        .lp-role-desc {
            font-size: 0.8rem;
            color: #526174;
            line-height: 1.55;
            margin-bottom: 0.75rem;
        }
        .lp-role-tag {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 600;
            color: #B08D57;
            background: #FEF8E7;
            border: 1px solid rgba(176,141,87,0.3);
            border-radius: 5px;
            padding: 3px 10px;
        }

        /* ── Final CTA Section ───────────────────────────────── */
        .lp-cta {
            background: #172033;
            border-radius: 16px;
            padding: 3.8rem 2.5rem 2.5rem;
            text-align: center;
            width: 100%;
            box-shadow: 0 10px 36px rgba(23,32,51,0.18);
        }
        .lp-cta-h3 {
            font-size: 2.3rem;
            font-weight: 800;
            color: #FFFFFF;
            letter-spacing: -0.6px;
            margin: 0 0 1rem;
        }
        .lp-cta-p {
            color: rgba(255,255,255,0.72);
            font-size: 1.08rem;
            max-width: 620px;
            margin: 0 auto 2rem;
            line-height: 1.7;
        }

        /* ── Dividers ────────────────────────────────────────── */
        .lp-sep {
            height: 1px;
            background: #D9D6CF;
            margin: clamp(2rem, 3vh, 3rem) 0;
            width: 100%;
        }

        /* ── Footer ──────────────────────────────────────────── */
        .lp-foot {
            border-top: 1px solid #D9D6CF;
            padding: 3rem 1.5rem 2.5rem;
            text-align: center;
            width: 100%;
        }
        .lp-foot-brand {
            font-size: 1.15rem;
            font-weight: 800;
            color: #172033;
            margin-bottom: 0.4rem;
        }
        .lp-foot-sub {
            font-size: 0.88rem;
            color: #526174;
            margin-bottom: 1.35rem;
        }
        .lp-foot-links {
            font-size: 0.84rem;
            color: #68707C;
            margin-bottom: 1.35rem;
        }
        .lp-foot-links a {
            color: #526174;
            text-decoration: none;
            margin: 0 0.65rem;
            font-weight: 500;
            transition: color 0.15s;
        }
        .lp-foot-links a:hover {
            color: #172033;
            text-decoration: underline;
        }
        .vp-foot {
            font-size: 0.78rem;
            color: #8C93A0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    # ── Navbar ─────────────────────────────────────────────────────────────────
    st.markdown(
        """
        <div class="lp-nav">
            <div class="lp-nav-left">
                <div class="lp-logo">
                    <div class="lp-logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                             stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </div>
                    VendorPulse
                </div>
                <div class="lp-nav-links">
                    <a href="#platform" class="lp-nav-link">Platform</a>
                    <a href="#features" class="lp-nav-link">Features</a>
                    <a href="#solutions" class="lp-nav-link">Solutions</a>
                    <a href="#risk" class="lp-nav-link">Risk &amp; Compliance</a>
                </div>
            </div>
            <div class="lp-nav-right">
                <span class="lp-nav-tag">Enterprise v2.0</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Navbar action buttons — use a wide spacer then two tight buttons
    nb_space, nb1, nb2 = st.columns([9.5, 1.1, 1.4])
    with nb1:
        if st.button("Sign In", key="nav_signin", use_container_width=True):
            navigate_to("login")
            st.rerun()
    with nb2:
        if st.button("Get Started", key="nav_register", type="primary", use_container_width=True):
            navigate_to("register")
            st.rerun()

    st.markdown("<div style='height:0.25rem;'></div>", unsafe_allow_html=True)

    # ── Hero Section (45% / 55% scale) ─────────────────────────────────────────
    hero_col, preview_col = st.columns([46, 54], gap="medium")

    with hero_col:
        st.markdown(
            """
            <div class="lp-hero-wrap">
                <div class="lp-label">A Smarter Procurement Ecosystem</div>
                <h1 class="lp-h1">
                    Vendor Reliability Intelligence &amp; Procurement Risk Management
                </h1>
                <p class="lp-sub">
                    Manage vendors, procurement workflows, purchase orders, contracts
                    and supplier risk from one unified platform.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

        hero_btn1, hero_btn2, _ = st.columns([1.5, 1.3, 1.0])
        with hero_btn1:
            if st.button("Get Started", key="hero_register", type="primary", use_container_width=True):
                navigate_to("register")
                st.rerun()
        with hero_btn2:
            if st.button("Sign In", key="hero_signin", use_container_width=True):
                navigate_to("login")
                st.rerun()

        st.markdown(
            """
            <div class="lp-hero-trust">
                <span class="badge">&#10003; ISO 27001 Certified</span>
                <span>&bull;</span>
                <span class="badge">&#10003; SOC 2 Type II</span>
                <span>&bull;</span>
                <span class="badge">&#10003; Enterprise Ready</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with preview_col:
        st.markdown(
            f"""
            <div class="lp-preview">
                <div class="lp-preview-hdr">
                    <div class="lp-preview-title">Supplier Intelligence Dashboard</div>
                    <div class="lp-live">
                        <div class="lp-live-dot"></div>
                        Live Telemetry
                    </div>
                </div>
                <div class="lp-preview-grid">
                    <div class="lp-stat-mini">
                        <div class="lp-stat-lbl">Active Vendors</div>
                        <div class="lp-stat-val">{active_vendors:,}</div>
                        <div class="lp-stat-sub">92% Verified</div>
                    </div>
                    <div class="lp-stat-mini">
                        <div class="lp-stat-lbl">Reliability Score</div>
                        <div class="lp-stat-val" style="color:#B08D57;">{avg_rel}%</div>
                        <div class="lp-stat-sub">High Tier Index</div>
                    </div>
                    <div class="lp-stat-mini">
                        <div class="lp-stat-lbl">On-Time Delivery</div>
                        <div class="lp-stat-val">96.8%</div>
                        <div class="lp-stat-sub">+1.4% MoM</div>
                    </div>
                    <div class="lp-stat-mini">
                        <div class="lp-stat-lbl">Total Suppliers</div>
                        <div class="lp-stat-val">{total_vendors:,}</div>
                        <div class="lp-stat-sub">Global Directory</div>
                    </div>
                </div>
                <div class="lp-risk-panel">
                    <div class="lp-risk-hdr">
                        <span class="lp-risk-title">Real-Time Risk Distribution</span>
                        <span class="lp-risk-sub">24,000+ Monitored Suppliers</span>
                    </div>
                    <div class="lp-risk-bar">
                        <div style="width:30%;background:#2D6A4A;border-radius:6px 0 0 6px;"></div>
                        <div style="width:22%;background:#B08D57;"></div>
                        <div style="width:32%;background:#A67C32;"></div>
                        <div style="width:16%;background:#8B3038;border-radius:0 6px 6px 0;"></div>
                    </div>
                    <div class="lp-risk-legend">
                        <span><b style="color:#2D6A4A;">&#9679;</b> Low 30%</span>
                        <span><b style="color:#B08D57;">&#9679;</b> Moderate 22%</span>
                        <span><b style="color:#A67C32;">&#9679;</b> High 32%</span>
                        <span><b style="color:#8B3038;">&#9679;</b> Critical 16%</span>
                    </div>
                </div>
                <div class="lp-preview-foot">
                    Role-Based Access Control &bull; AES-256 Encryption &bull; High-Throughput FastAPI + MongoDB
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # ── Divider ────────────────────────────────────────────────────────────────
    st.markdown("<div class='lp-sep'></div>", unsafe_allow_html=True)

    # ── Platform Capabilities (6 cards desktop) ────────────────────────────────
    st.markdown(
        """
        <div class="lp-sec-wrap" id="features">
            <div class="lp-sec-label">Platform Capabilities</div>
            <h2 class="lp-sec-h2">Everything You Need for Smarter Procurement</h2>
            <p class="lp-sec-sub">
                A unified enterprise platform covering the full procurement lifecycle
                from vendor onboarding to contract expiry.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    CAPABILITIES = [
        (
            "Vendor Management",
            "End-to-end supplier profiles, category classification, and structured multi-step approval workflows.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        ),
        (
            "Procurement Management",
            "Requisition routing, vendor assignment, budget compliance, and auditable status transitions.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        ),
        (
            "Purchase Orders",
            "Full PO lifecycle management from creation to delivery with automated order milestone tracking.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        ),
        (
            "Contract Management",
            "Contract drafting, approval, expiry alerts, and lifecycle compliance tracking in one central repository.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
        ),
        (
            "Communication",
            "Integrated secure messaging between procurement teams and vendors with automated notifications.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        ),
        (
            "Risk & Performance",
            "Real-time evaluation of reliability scores, defect rates, geopolitical exposures, and supply disruptions.",
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        ),
    ]

    feat_cols = st.columns(6, gap="small")
    for col, (title, desc, icon) in zip(feat_cols, CAPABILITIES):
        with col:
            st.markdown(
                f"""
                <div class="lp-feat">
                    <div class="lp-feat-icon">{icon}</div>
                    <div class="lp-feat-title">{title}</div>
                    <div class="lp-feat-desc">{desc}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # ── Divider ────────────────────────────────────────────────────────────────
    st.markdown("<div class='lp-sep'></div>", unsafe_allow_html=True)

    # ── Procurement Workflow (Full Width) ──────────────────────────────────────
    st.markdown(
        """
        <div class="lp-sec-wrap" id="platform">
            <div class="lp-sec-label">Procurement Workflow</div>
            <h2 class="lp-sec-h2">From Request to Completion</h2>
            <p class="lp-sec-sub">
                A streamlined, auditable workflow routing every procurement request
                through each stage with full accountability.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    STEPS = [
        ("Procurement\nRequest",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
         False),
        ("Approval",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
         False),
        ("Vendor\nAssignment",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
         False),
        ("Purchase\nOrder",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
         False),
        ("Order\nTracking",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
         False),
        ("Delivery",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
         False),
        ("Completion",
         '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
         True),
    ]

    arrow_svg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B08D57" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'

    step_html = '<div class="lp-workflow-wrap"><div class="lp-step-row">'
    for i, (label, icon, is_active) in enumerate(STEPS):
        icon_cls = "lp-step-icon-active" if is_active else "lp-step-icon"
        step_html += f"""
            <div class="lp-step">
                <div class="{icon_cls}">{icon}</div>
                <div class="lp-step-num">Step {i + 1}</div>
                <div class="lp-step-lbl">{label.replace(chr(10), "<br>")}</div>
            </div>
        """
        if i < len(STEPS) - 1:
            step_html += f'<div class="lp-step-arrow">{arrow_svg}</div>'
    step_html += "</div></div>"
    st.markdown(step_html, unsafe_allow_html=True)

    # ── Divider ────────────────────────────────────────────────────────────────
    st.markdown("<div class='lp-sep'></div>", unsafe_allow_html=True)

    # ── Role-Based Access (6 cards desktop) ────────────────────────────────────
    st.markdown(
        """
        <div class="lp-sec-wrap" id="solutions">
            <div class="lp-sec-label">Role-Based Access</div>
            <h2 class="lp-sec-h2">Built for Every Stakeholder</h2>
            <p class="lp-sec-sub">
                Purpose-built dashboards and permissions for each role in your
                procurement and supply chain organization.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    ROLES = [
        {
            "name": "Administrator",
            "desc": "Full system access, user management, audit trails, and platform configuration.",
            "tag": "Full Access",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        },
        {
            "name": "Procurement Manager",
            "desc": "Manage procurement requests, approvals, requisition lifecycle, and PO issuance.",
            "tag": "Procurement",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
        },
        {
            "name": "Supply Chain Mgr",
            "desc": "Oversee vendor performance, delivery tracking, milestone SLAs, and risk alerts.",
            "tag": "Supply Chain",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        },
        {
            "name": "Vendor Portal",
            "desc": "Submit profiles, respond to POs, upload documentation, and manage order fulfillment.",
            "tag": "Supplier Portal",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
        },
        {
            "name": "Finance Officer",
            "desc": "Review spend, validate purchase orders, track invoices, and monitor budget compliance.",
            "tag": "Finance",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        },
        {
            "name": "Auditor",
            "desc": "Read-only access to reports, audit trails, compliance certifications, and risk matrices.",
            "tag": "Audit & Risk",
            "icon": '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        },
    ]

    role_cols = st.columns(6, gap="small")
    for col, r in zip(role_cols, ROLES):
        with col:
            st.markdown(
                f"""
                <div class="lp-role">
                    <div class="lp-role-avatar">{r['icon']}</div>
                    <div class="lp-role-name">{r['name']}</div>
                    <div class="lp-role-desc">{r['desc']}</div>
                    <div class="lp-role-tag">{r['tag']}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # ── Divider ────────────────────────────────────────────────────────────────
    st.markdown("<div class='lp-sep'></div>", unsafe_allow_html=True)

    # ── Final Call to Action (Full Width) ──────────────────────────────────────
    st.markdown(
        """
        <div class="lp-cta" id="risk">
            <h3 class="lp-cta-h3">
                Bring Vendor and Procurement Operations Into One Platform
            </h3>
            <p class="lp-cta-p">
                Unified vendor intelligence, procurement automation, and risk management
                for modern supply chains.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("<div style='height:1rem;'></div>", unsafe_allow_html=True)
    _, cta_btn1, cta_btn2, _ = st.columns([2.0, 1.3, 1.3, 2.0])
    with cta_btn1:
        if st.button("Get Started", key="cta_getstarted", type="primary", use_container_width=True):
            navigate_to("register")
            st.rerun()
    with cta_btn2:
        if st.button("Sign In", key="cta_signin", use_container_width=True):
            navigate_to("login")
            st.rerun()

    # ── Footer ────────────────────────────────────────────────────────────────
    st.markdown("<div style='height:2.5rem;'></div>", unsafe_allow_html=True)
    st.markdown(
        """
        <div class="lp-foot">
            <div class="lp-foot-brand">VendorPulse</div>
            <div class="lp-foot-sub">
                Vendor Reliability Intelligence &amp; Procurement Risk Management Platform
            </div>
            <div class="lp-foot-links">
                <a href="#platform">Platform</a> &bull;
                <a href="#features">Features</a> &bull;
                <a href="#solutions">Solutions</a> &bull;
                <a href="#risk">Risk &amp; Compliance</a> &bull;
                <a href="#">Privacy Policy</a> &bull;
                <a href="#">Terms of Service</a>
            </div>
            <div class="vp-foot">
                &copy; 2026 VendorPulse Inc. All rights reserved.
                &bull; Enterprise Supplier Intelligence &amp; Procurement Management &bull; v2.0.0
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
