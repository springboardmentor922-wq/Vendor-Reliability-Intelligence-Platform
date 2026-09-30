"""
app.py
------
Main entry point for the Vendor Reliability Intelligence Platform (VendorPulse).
Run with: streamlit run app.py

Architecture:
    Browser → Streamlit UI → FastAPI Backend (port 8000) → MongoDB
"""

import threading
import time
import socket
import logging
import streamlit as st

logger = logging.getLogger(__name__)

# ── Start FastAPI in background thread if not already running ──────────────────
def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if "fastapi_started" not in st.session_state:
    if not is_port_in_use(8000):
        def start_fastapi():
            try:
                import uvicorn
                from api.main import app as fastapi_app
                uvicorn.run(fastapi_app, host="127.0.0.1", port=8000, log_level="warning")
            except Exception as e:
                logger.error("FastAPI background thread error: %s", e)

        api_thread = threading.Thread(target=start_fastapi, daemon=True)
        api_thread.start()
        time.sleep(0.5)
    st.session_state["fastapi_started"] = True

# ── Must be the FIRST Streamlit call ──────────────────────────────────────────
st.set_page_config(
    page_title="VendorPulse — Enterprise Procurement Platform",
    page_icon="VP",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        "Get Help": None,
        "Report a bug": None,
        "About": "VendorPulse — Reliable Vendors. Smarter Procurement. v3.0.0 | Milestone 3",
    },
)

# ── Global CSS — Deep Navy + Warm Ivory + Muted Gold Design System ─────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    html, body, [class*="css"] {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    html, body {
        overflow-x: hidden !important;
    }

    /* Page background: Warm Ivory #F7F5F0 */
    .stApp {
        background: #F7F5F0 !important;
        min-height: 100vh;
    }

    /* Left Sidebar — Deep Navy #172033 */
    [data-testid="stSidebar"] {
        min-width: 245px !important;
        max-width: 265px !important;
        width: 255px !important;
        background: #172033 !important;
        border-right: 1px solid #2A3548 !important;
    }
    [data-testid="stSidebar"] > div:first-child {
        padding-top: 0.75rem !important;
        padding-bottom: 1.5rem !important;
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
    }

    /* Sidebar buttons styling */
    [data-testid="stSidebar"] .stButton {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    [data-testid="stSidebar"] .stButton > button,
    [data-testid="stSidebar"] button[kind="secondary"],
    [data-testid="stSidebar"] [data-testid="stBaseButton-secondary"] {
        display: flex !important;
        flex-direction: row !important;
        justify-content: flex-start !important;
        align-items: center !important;
        text-align: left !important;
        background: transparent !important;
        color: #8A95A3 !important;
        border: none !important;
        padding: 0.42rem 0.75rem !important;
        border-radius: 6px !important;
        transition: all 0.15s ease !important;
        font-size: 0.84rem !important;
        font-weight: 500 !important;
        width: 100% !important;
        margin: 0.06rem 0 !important;
    }
    [data-testid="stSidebar"] .stButton > button p,
    [data-testid="stSidebar"] .stButton > button div,
    [data-testid="stSidebar"] .stButton > button span,
    [data-testid="stSidebar"] button[kind="secondary"] p,
    [data-testid="stSidebar"] [data-testid="stBaseButton-secondary"] p {
        text-align: left !important;
        justify-content: flex-start !important;
        align-items: center !important;
        display: flex !important;
        width: 100% !important;
        font-size: 0.84rem !important;
        margin: 0 !important;
    }
    [data-testid="stSidebar"] .stButton > button:hover,
    [data-testid="stSidebar"] button[kind="secondary"]:hover,
    [data-testid="stSidebar"] [data-testid="stBaseButton-secondary"]:hover {
        background: #1E2D42 !important;
        color: #FFFFFF !important;
        transform: translateX(2px) !important;
    }
    [data-testid="stSidebar"] .stButton > button:hover p,
    [data-testid="stSidebar"] button[kind="secondary"]:hover p {
        color: #FFFFFF !important;
    }

    /* Main container */
    .main .block-container {
        padding: 1rem 2rem 2.5rem !important;
        max-width: 100% !important;
        width: 100% !important;
    }

    /* Form Inputs — Clean White with warm borders */
    div[data-baseweb="input"],
    div[data-baseweb="base-input"],
    .stTextInput > div > div,
    .stNumberInput > div > div,
    .stTextArea > div > div,
    .stDateInput > div > div,
    .stSelectbox > div > div,
    [data-baseweb="select"] > div {
        background: #FFFFFF !important;
        border: 1px solid #D9D6CF !important;
        border-radius: 7px !important;
        color: #20242A !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
    }

    .stTextInput input,
    .stNumberInput input,
    .stTextArea textarea,
    .stDateInput input,
    [data-baseweb="input"] input,
    [data-baseweb="base-input"] input {
        background: transparent !important;
        color: #20242A !important;
        -webkit-text-fill-color: #20242A !important;
        caret-color: #B08D57 !important;
        font-weight: 400 !important;
        font-size: 0.875rem !important;
    }

    /* Input Focus — Gold accent */
    div[data-baseweb="input"]:focus-within,
    .stTextInput > div > div:focus-within,
    .stTextArea > div > div:focus-within,
    [data-baseweb="select"] > div:focus-within {
        border-color: #B08D57 !important;
        box-shadow: 0 0 0 3px rgba(176,141,87,0.15) !important;
    }

    input::placeholder,
    textarea::placeholder {
        color: #9BA3AD !important;
        -webkit-text-fill-color: #9BA3AD !important;
        opacity: 0.85 !important;
    }

    /* Selectbox Dropdown Menus */
    [data-baseweb="select"] span {
        color: #20242A !important;
    }
    [data-baseweb="select"] svg {
        fill: #68707C !important;
        color: #68707C !important;
    }
    [data-baseweb="popover"], [data-baseweb="menu"] {
        background: #FFFFFF !important;
        border: 1px solid #D9D6CF !important;
        box-shadow: 0 4px 20px rgba(23,32,51,0.12) !important;
        border-radius: 8px !important;
    }
    [data-baseweb="menu"] li {
        color: #20242A !important;
        background: #FFFFFF !important;
        font-size: 0.875rem !important;
    }
    [data-baseweb="menu"] li:hover,
    [data-baseweb="menu"] [aria-selected="true"] {
        background: #F7F5F0 !important;
        color: #172033 !important;
        font-weight: 500 !important;
    }

    /* Labels */
    .stTextInput label, .stNumberInput label, .stTextArea label,
    .stSelectbox label, .stCheckbox label, .stDateInput label {
        color: #20242A !important;
        font-weight: 600 !important;
        font-size: 0.84rem !important;
    }

    /* Primary Buttons — Deep Navy #172033 */
    .stButton > button[kind="primary"] {
        background: #172033 !important;
        border: none !important;
        color: #FFFFFF !important;
        font-weight: 600 !important;
        border-radius: 7px !important;
        padding: 0.5rem 1.25rem !important;
        box-shadow: 0 2px 6px rgba(23,32,51,0.25) !important;
        transition: all 0.2s ease !important;
    }
    .stButton > button[kind="primary"]:hover {
        background: #3E4A61 !important;
        box-shadow: 0 4px 14px rgba(23,32,51,0.3) !important;
        transform: translateY(-1px) !important;
    }

    /* Secondary Buttons */
    .stButton > button[kind="secondary"]:not([data-testid="stSidebar"] button) {
        background: #FFFFFF !important;
        border: 1px solid #D9D6CF !important;
        color: #20242A !important;
        font-weight: 600 !important;
        border-radius: 7px !important;
    }
    .stButton > button[kind="secondary"]:not([data-testid="stSidebar"] button):hover {
        background: #F7F5F0 !important;
        border-color: #B08D57 !important;
        color: #172033 !important;
    }

    /* Tabs — Clean White with Navy active indicator */
    .stTabs [data-baseweb="tab-list"] {
        background: #FFFFFF !important;
        border-radius: 8px !important;
        padding: 4px !important;
        gap: 4px !important;
        border: 1px solid #D9D6CF !important;
    }
    .stTabs [data-baseweb="tab"] {
        background: transparent !important;
        color: #68707C !important;
        border-radius: 6px !important;
        font-size: 0.875rem !important;
        font-weight: 600 !important;
        padding: 0.4rem 0.9rem !important;
    }
    .stTabs [aria-selected="true"] {
        background: #172033 !important;
        color: #FFFFFF !important;
    }

    /* Metrics Container */
    [data-testid="metric-container"] {
        background: #FFFFFF !important;
        border: 1px solid #D9D6CF !important;
        border-radius: 10px !important;
        padding: 0.9rem !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
    }

    /* Dataframe */
    [data-testid="stDataFrame"] {
        border: 1px solid #D9D6CF !important;
        border-radius: 8px !important;
        background: #FFFFFF !important;
    }

    /* Expanders */
    .stExpander {
        background: #FFFFFF !important;
        border: 1px solid #D9D6CF !important;
        border-radius: 10px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
    }

    /* Success / Info / Warning / Error messages */
    .stAlert {
        border-radius: 8px !important;
        border-left-width: 4px !important;
    }

    /* Hide Streamlit watermark */
    footer { visibility: hidden; }
    #MainMenu { visibility: hidden; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Imports (after set_page_config) ──────────────────────────────────────────
from utils.logger import setup_logging
from auth.session import init_session, is_authenticated, get_current_page, get_current_role, navigate_to
from auth.permissions import has_page_access
from components.sidebar import render_sidebar

# ── Startup ───────────────────────────────────────────────────────────────────
setup_logging()

# Initialize MongoDB indexes on first run
if "db_initialized" not in st.session_state:
    try:
        from database.connection import get_database
        from database.indexes import create_all_indexes
        db = get_database()
        create_all_indexes(db)
        st.session_state["db_initialized"] = True
    except Exception as e:
        st.session_state["db_initialized"] = False
        st.session_state["db_error"] = str(e)

# ── Initialize session state ──────────────────────────────────────────────────
init_session()

# ── DB connection warning (non-blocking) ─────────────────────────────────────
if not st.session_state.get("db_initialized", False):
    db_err = st.session_state.get("db_error", "Unknown error")
    st.warning(
        f"**MongoDB connection issue:** {db_err}\n\n"
        "Please check your `.env` file and ensure MongoDB is running. "
        "Authentication requires a working database connection.",
    )

# ── Route to Landing / Login / Register if not authenticated ────────────────────
if not is_authenticated():
    current_page = get_current_page()

    if current_page == "register":
        from views.register import render_register_page
        render_register_page()
    elif current_page == "login":
        from views.login import render_login_page
        render_login_page()
    else:
        # Default unauthenticated route: Landing Page
        from views.landing import render_landing_page
        render_landing_page()

    st.stop()


# ── Authenticated: render sidebar + routed page ───────────────────────────────
render_sidebar()

current_page = get_current_page()
role = get_current_role()

# Security guard — prevent direct page access via session manipulation
# Also enforces backend RBAC: a Vendor cannot navigate to 'vendors', 'performance', etc.
# by manually setting the session page key.
if current_page not in ("dashboard", "profile", "settings", "login", "register", "landing"):
    if not has_page_access(role, current_page):
        navigate_to("dashboard")
        st.rerun()

# ── Page Routing ───────────────────────────────────────────────────────────────
if current_page == "dashboard":
    from views.dashboard import render_dashboard
    render_dashboard()

elif current_page == "vendor_management":
    from views.vendor_management import render_vendor_management_page
    render_vendor_management_page()

elif current_page == "vendors":
    from views.vendors import render_vendors_page
    render_vendors_page()

elif current_page == "vendor_categories":
    from views.vendor_categories import render_vendor_categories_page
    render_vendor_categories_page()

elif current_page == "vendor_portal":
    from views.vendor_portal import render_vendor_portal_page
    render_vendor_portal_page()

elif current_page == "register_vendor":
    from views.register_vendor import render_register_vendor_page
    render_register_vendor_page()

elif current_page == "approve_vendor":
    from views.approve_vendor import render_approve_vendor_page
    render_approve_vendor_page()

elif current_page == "approval_queue":
    from views.approval_queue import render_approval_queue_page
    render_approval_queue_page()

elif current_page == "procurement":
    from views.procurement import render_procurement_page
    render_procurement_page()

elif current_page == "purchase_orders":
    from views.purchase_orders import render_purchase_orders_page
    render_purchase_orders_page()

elif current_page == "invoices":
    from views.invoices import render_invoices_page
    render_invoices_page()

elif current_page == "contracts":
    from views.contracts import render_contracts_page
    render_contracts_page()

elif current_page == "communication":
    from views.communication import render_communication_page
    render_communication_page()

elif current_page == "performance":
    from views.performance import render_performance_page
    render_performance_page()

elif current_page == "risk_analysis":
    from views.risk_analysis import render_risk_analysis_page
    render_risk_analysis_page()

elif current_page == "analytics":
    from views.analytics import render_analytics_page
    render_analytics_page()

elif current_page == "reports":
    from views.reports import render_reports_page
    render_reports_page()

elif current_page == "notifications":
    from views.notifications import render_notifications_page
    render_notifications_page()

elif current_page == "settings":
    from views.settings import render_settings_page
    render_settings_page()

elif current_page == "profile":
    from views.profile import render_profile_page
    render_profile_page()

elif current_page == "audit":
    from views.audit import render_audit_page
    render_audit_page()

else:
    # Unknown page — redirect to dashboard
    from views.dashboard import render_dashboard
    render_dashboard()
