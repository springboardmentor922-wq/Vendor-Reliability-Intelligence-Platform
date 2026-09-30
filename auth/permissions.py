"""
auth/permissions.py
-------------------
Role-Based Access Control (RBAC) permission matrix for VendorPulse.

Seven roles:
  1. Administrator
  2. Procurement Manager        — procurement-focused; NO vendor management pages
  3. Supply Chain Manager
  4. Vendor Manager             — manages all 6 vendor categories; sees overall performance
  5. Vendor (Individual)        — sees ONLY its own portal (vendor_portal page)
  6. Finance Officer
  7. Auditor
"""

from typing import Dict, List, Set

# ── Canonical Role Names ──────────────────────────────────────────────────────
ROLE_ADMINISTRATOR        = "Administrator"
ROLE_PROCUREMENT_MANAGER  = "Procurement Manager"
ROLE_SUPPLY_CHAIN_MANAGER = "Supply Chain Manager"
ROLE_VENDOR_MANAGER       = "Vendor Manager"   # ← NEW: overall vendor management
ROLE_VENDOR               = "Vendor"           # ← individual vendor account
ROLE_FINANCE_OFFICER      = "Finance Officer"
ROLE_AUDITOR              = "Auditor"

ALL_ROLES: List[str] = [
    ROLE_ADMINISTRATOR,
    ROLE_PROCUREMENT_MANAGER,
    ROLE_SUPPLY_CHAIN_MANAGER,
    ROLE_VENDOR_MANAGER,
    ROLE_VENDOR,
    ROLE_FINANCE_OFFICER,
    ROLE_AUDITOR,
]

# ── Page / Resource Keys ──────────────────────────────────────────────────────
PAGE_DASHBOARD           = "dashboard"
PAGE_VENDOR_MANAGEMENT   = "vendor_management"  # combined Vendors + Queue + Categories + Overall Perf
PAGE_VENDORS             = "vendors"
PAGE_VENDOR_CATEGORIES   = "vendor_categories"
PAGE_APPROVAL_QUEUE      = "approval_queue"
PAGE_REGISTER_VENDOR     = "register_vendor"    # standalone vendor registration form
PAGE_APPROVE_VENDOR      = "approve_vendor"     # standalone vendor approval queue
PAGE_PROCUREMENT         = "procurement"
PAGE_PURCHASE_ORDERS     = "purchase_orders"
PAGE_INVOICES            = "invoices"
PAGE_CONTRACTS           = "contracts"
PAGE_COMMUNICATION       = "communication"
PAGE_PERFORMANCE         = "performance"        # global — Vendor Manager / Admin / SCM only
PAGE_VENDOR_PORTAL       = "vendor_portal"      # isolated self-only view for ROLE_VENDOR
PAGE_RISK_ANALYSIS       = "risk_analysis"
PAGE_ANALYTICS           = "analytics"
PAGE_REPORTS             = "reports"
PAGE_NOTIFICATIONS       = "notifications"
PAGE_SETTINGS            = "settings"
PAGE_PROFILE             = "profile"
PAGE_ADMIN               = "admin"
PAGE_LANDING             = "landing"
PAGE_AUDIT               = "audit"

# ── Action Permission Keys ────────────────────────────────────────────────────
ACTION_CREATE_VENDOR  = "create_vendor"
ACTION_EDIT_VENDOR    = "edit_vendor"
ACTION_DELETE_VENDOR  = "delete_vendor"
ACTION_APPROVE_VENDOR = "approve_vendor"
ACTION_VIEW_VENDORS   = "view_vendors"

ACTION_CREATE_PR          = "create_procurement_request"
ACTION_APPROVE_PR         = "approve_procurement_request"
ACTION_VIEW_PR            = "view_procurement_request"
ACTION_ASSIGN_VENDOR_PR   = "assign_vendor_to_pr"

ACTION_CREATE_PO  = "create_purchase_order"
ACTION_EDIT_PO    = "edit_purchase_order"
ACTION_VIEW_PO    = "view_purchase_order"
ACTION_APPROVE_PO = "approve_purchase_order"

# Vendor accept/reject procurement request
ACTION_ACCEPT_VENDOR_REQUEST = "accept_vendor_request"
ACTION_REJECT_VENDOR_REQUEST = "reject_vendor_request"

# Invoice actions
ACTION_VIEW_INVOICES  = "view_invoices"
ACTION_VERIFY_INVOICE = "verify_invoice"

ACTION_VIEW_CONTRACTS   = "view_contracts"
ACTION_CREATE_CONTRACT  = "create_contract"
ACTION_EDIT_CONTRACT    = "edit_contract"

ACTION_VIEW_PERFORMANCE = "view_performance"
ACTION_RATE_VENDOR      = "rate_vendor"

ACTION_VIEW_ANALYTICS = "view_analytics"
ACTION_VIEW_REPORTS   = "view_reports"
ACTION_EXPORT_REPORTS = "export_reports"

ACTION_SEND_MESSAGE  = "send_message"
ACTION_VIEW_MESSAGES = "view_messages"

ACTION_MANAGE_USERS       = "manage_users"
ACTION_VIEW_AUDIT_LOGS    = "view_audit_logs"
ACTION_VIEW_AUDIT_TRAIL   = "view_audit_trail"
ACTION_SYSTEM_CONFIG      = "system_config"

# Finance Verification actions
ACTION_SUBMIT_INVOICE                  = "submit_invoice"
ACTION_FINANCE_VERIFY                  = "finance_verify_invoice"
ACTION_DOWNLOAD_VERIFICATION_REPORT    = "download_verification_report"
ACTION_SETTLE_PAYMENT                  = "settle_payment"

# ── Permission Matrix ─────────────────────────────────────────────────────────

ROLE_PERMISSIONS: Dict[str, Dict[str, Set[str]]] = {

    # ── Administrator ─────────────────────────────────────────────────────────
    ROLE_ADMINISTRATOR: {
        "pages": {
            PAGE_DASHBOARD, PAGE_VENDOR_MANAGEMENT, PAGE_VENDORS, PAGE_VENDOR_CATEGORIES,
            PAGE_APPROVAL_QUEUE,
            PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS, PAGE_INVOICES, PAGE_CONTRACTS,
            PAGE_COMMUNICATION, PAGE_PERFORMANCE, PAGE_VENDOR_PORTAL,
            PAGE_RISK_ANALYSIS, PAGE_ANALYTICS, PAGE_REPORTS, PAGE_NOTIFICATIONS,
            PAGE_SETTINGS, PAGE_PROFILE, PAGE_ADMIN, PAGE_AUDIT,
        },
        "actions": {
            ACTION_CREATE_VENDOR, ACTION_EDIT_VENDOR, ACTION_DELETE_VENDOR,
            ACTION_APPROVE_VENDOR, ACTION_VIEW_VENDORS,
            ACTION_CREATE_PR, ACTION_APPROVE_PR, ACTION_VIEW_PR, ACTION_ASSIGN_VENDOR_PR,
            ACTION_CREATE_PO, ACTION_EDIT_PO, ACTION_VIEW_PO, ACTION_APPROVE_PO,
            ACTION_VIEW_INVOICES, ACTION_VERIFY_INVOICE, ACTION_FINANCE_VERIFY,
            ACTION_SUBMIT_INVOICE, ACTION_DOWNLOAD_VERIFICATION_REPORT, ACTION_SETTLE_PAYMENT,
            ACTION_VIEW_CONTRACTS, ACTION_CREATE_CONTRACT, ACTION_EDIT_CONTRACT,
            ACTION_VIEW_PERFORMANCE, ACTION_RATE_VENDOR,
            ACTION_VIEW_ANALYTICS, ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS,
            ACTION_SEND_MESSAGE, ACTION_VIEW_MESSAGES,
            ACTION_MANAGE_USERS, ACTION_VIEW_AUDIT_LOGS, ACTION_VIEW_AUDIT_TRAIL,
            ACTION_SYSTEM_CONFIG,
        },
    },

    # ── Procurement Manager ───────────────────────────────────────────────────
    # INTENTIONALLY does NOT include PAGE_VENDOR_MANAGEMENT, PAGE_VENDORS,
    # PAGE_VENDOR_CATEGORIES, PAGE_APPROVAL_QUEUE, PAGE_PERFORMANCE, PAGE_RISK_ANALYSIS.
    # Vendor management and overall vendor performance is handled by Vendor Manager.
    # Procurement Manager is focused solely on the procurement workflow.
    ROLE_PROCUREMENT_MANAGER: {
        "pages": {
            PAGE_DASHBOARD,
            PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS, PAGE_INVOICES, PAGE_CONTRACTS,
            PAGE_COMMUNICATION,
            PAGE_REPORTS, PAGE_NOTIFICATIONS, PAGE_SETTINGS, PAGE_PROFILE,
            # NOTE: PAGE_VENDOR_MANAGEMENT is intentionally EXCLUDED.
        },
        "actions": {
            # Procurement workflow — full access
            ACTION_CREATE_PR, ACTION_APPROVE_PR, ACTION_VIEW_PR, ACTION_ASSIGN_VENDOR_PR,
            ACTION_CREATE_PO, ACTION_EDIT_PO, ACTION_VIEW_PO, ACTION_APPROVE_PO,
            # Invoice viewing (read-only; Finance verifies)
            ACTION_VIEW_INVOICES, ACTION_DOWNLOAD_VERIFICATION_REPORT,
            # Contracts
            ACTION_VIEW_CONTRACTS, ACTION_CREATE_CONTRACT, ACTION_EDIT_CONTRACT,
            # Analytics / Reports
            ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS,
            # Messaging
            ACTION_SEND_MESSAGE, ACTION_VIEW_MESSAGES,
            # Vendor lookup (read-only, needed to assign vendors to PRs)
            ACTION_VIEW_VENDORS,
        },
    },

    # ── Supply Chain Manager ──────────────────────────────────────────────────
    ROLE_SUPPLY_CHAIN_MANAGER: {
        "pages": {
            PAGE_DASHBOARD, PAGE_VENDOR_MANAGEMENT, PAGE_VENDORS, PAGE_VENDOR_CATEGORIES,
            PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS, PAGE_CONTRACTS, PAGE_COMMUNICATION,
            PAGE_PERFORMANCE, PAGE_RISK_ANALYSIS, PAGE_ANALYTICS, PAGE_NOTIFICATIONS,
            PAGE_SETTINGS, PAGE_PROFILE,
        },
        "actions": {
            ACTION_VIEW_VENDORS, ACTION_EDIT_VENDOR,
            ACTION_CREATE_PR, ACTION_VIEW_PR,
            ACTION_CREATE_PO, ACTION_EDIT_PO, ACTION_VIEW_PO,
            ACTION_VIEW_CONTRACTS,
            ACTION_VIEW_PERFORMANCE, ACTION_RATE_VENDOR,
            ACTION_VIEW_ANALYTICS,
            ACTION_SEND_MESSAGE, ACTION_VIEW_MESSAGES,
        },
    },

    # ── Vendor Manager ────────────────────────────────────────────────────────
    # Manages all 6 vendor categories via the combined Vendor Management module.
    # Can view overall vendor performance across all categories.
    # Does NOT have procurement workflow (PR/PO creation).
    ROLE_VENDOR_MANAGER: {
        "pages": {
            PAGE_DASHBOARD,
            PAGE_REGISTER_VENDOR, PAGE_APPROVE_VENDOR,
            PAGE_VENDOR_MANAGEMENT, PAGE_VENDORS, PAGE_VENDOR_CATEGORIES,
            PAGE_APPROVAL_QUEUE, PAGE_PERFORMANCE, PAGE_RISK_ANALYSIS, PAGE_ANALYTICS,
            PAGE_COMMUNICATION, PAGE_REPORTS, PAGE_NOTIFICATIONS, PAGE_SETTINGS, PAGE_PROFILE,
        },
        "actions": {
            ACTION_CREATE_VENDOR, ACTION_EDIT_VENDOR, ACTION_DELETE_VENDOR,
            ACTION_APPROVE_VENDOR, ACTION_VIEW_VENDORS,
            # Vendor assignment to procurement requests — core VM responsibility
            ACTION_ASSIGN_VENDOR_PR,
            # Read-only on procurement context (needed for vendor assignments)
            ACTION_VIEW_PR, ACTION_VIEW_PO,
            ACTION_VIEW_CONTRACTS,
            ACTION_VIEW_PERFORMANCE, ACTION_RATE_VENDOR,
            ACTION_VIEW_ANALYTICS, ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS,
            ACTION_SEND_MESSAGE, ACTION_VIEW_MESSAGES,
        },
    },

    # ── Vendor (Individual Account) ───────────────────────────────────────────
    # Each Vendor account is tied to ONE vendor_id.  It can ONLY see its own
    # data through the vendor_portal page.  It cannot access the global
    # performance page (PAGE_PERFORMANCE) — that shows all vendors.
    ROLE_VENDOR: {
        "pages": {
            PAGE_DASHBOARD,
            PAGE_VENDOR_PORTAL,     # isolated self-only portal (replaces PAGE_PERFORMANCE)
            PAGE_PURCHASE_ORDERS,   # view own POs only
            PAGE_CONTRACTS,         # view own contracts only
            PAGE_COMMUNICATION,     # own messages only
            PAGE_NOTIFICATIONS,
            PAGE_SETTINGS,
            PAGE_PROFILE,
        },
        "actions": {
            ACTION_VIEW_PR,
            ACTION_ACCEPT_VENDOR_REQUEST,
            ACTION_REJECT_VENDOR_REQUEST,
            ACTION_VIEW_PO,
            ACTION_VIEW_CONTRACTS,
            ACTION_VIEW_PERFORMANCE,   # used by vendor_portal internally
            ACTION_SEND_MESSAGE, ACTION_VIEW_MESSAGES,
        },
    },

    # ── Finance Officer ───────────────────────────────────────────────────────
    ROLE_FINANCE_OFFICER: {
        "pages": {
            PAGE_DASHBOARD, PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS, PAGE_INVOICES,
            PAGE_CONTRACTS, PAGE_RISK_ANALYSIS, PAGE_REPORTS, PAGE_NOTIFICATIONS,
            PAGE_SETTINGS, PAGE_PROFILE,
        },
        "actions": {
            ACTION_VIEW_PR,
            ACTION_VIEW_PO,
            ACTION_VIEW_INVOICES, ACTION_VERIFY_INVOICE, ACTION_FINANCE_VERIFY,
            ACTION_DOWNLOAD_VERIFICATION_REPORT, ACTION_SETTLE_PAYMENT,
            ACTION_VIEW_CONTRACTS,
            ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS,
            ACTION_VIEW_ANALYTICS,
        },
    },

    # ── Auditor ───────────────────────────────────────────────────────────────
    ROLE_AUDITOR: {
        "pages": {
            PAGE_DASHBOARD, PAGE_VENDOR_MANAGEMENT, PAGE_VENDORS, PAGE_VENDOR_CATEGORIES,
            PAGE_PROCUREMENT, PAGE_PURCHASE_ORDERS, PAGE_INVOICES, PAGE_CONTRACTS,
            PAGE_PERFORMANCE, PAGE_RISK_ANALYSIS, PAGE_ANALYTICS, PAGE_REPORTS,
            PAGE_NOTIFICATIONS, PAGE_COMMUNICATION, PAGE_AUDIT,
            PAGE_SETTINGS, PAGE_PROFILE,
        },
        "actions": {
            ACTION_VIEW_VENDORS,
            ACTION_VIEW_PR,
            ACTION_VIEW_PO,
            ACTION_VIEW_INVOICES, ACTION_DOWNLOAD_VERIFICATION_REPORT,
            ACTION_VIEW_CONTRACTS,
            ACTION_VIEW_PERFORMANCE,
            ACTION_VIEW_ANALYTICS,
            ACTION_VIEW_REPORTS, ACTION_EXPORT_REPORTS,
            ACTION_VIEW_MESSAGES,
            ACTION_VIEW_AUDIT_LOGS, ACTION_VIEW_AUDIT_TRAIL,
        },
    },
}


# ── Helper Functions ──────────────────────────────────────────────────────────

def has_page_access(role: str, page: str) -> bool:
    """Return True if the given role can access the given page."""
    perms = ROLE_PERMISSIONS.get(role, {})
    return page in perms.get("pages", set())


def has_action_permission(role: str, action: str) -> bool:
    """Return True if the given role can perform the given action."""
    perms = ROLE_PERMISSIONS.get(role, {})
    return action in perms.get("actions", set())


def get_allowed_pages(role: str) -> Set[str]:
    """Return the set of page keys accessible to the given role."""
    return ROLE_PERMISSIONS.get(role, {}).get("pages", set())


def get_allowed_actions(role: str) -> Set[str]:
    """Return the set of action keys the given role may perform."""
    return ROLE_PERMISSIONS.get(role, {}).get("actions", set())


def get_role_label(role: str) -> str:
    """Return a display-friendly role label."""
    return role  # Already human-readable


# ── Navigation Menu Configuration ─────────────────────────────────────────────
NAV_ITEMS = [
    {"key": PAGE_DASHBOARD,           "label": "Dashboard",            "icon": "grid"},
    {"key": PAGE_VENDOR_MANAGEMENT,   "label": "Vendor Management",     "icon": "users"},
    {"key": PAGE_VENDORS,             "label": "Vendors",              "icon": "users"},
    {"key": PAGE_VENDOR_CATEGORIES,   "label": "Vendor Categories",    "icon": "tag"},
    {"key": PAGE_APPROVAL_QUEUE,      "label": "Approval Queue",       "icon": "check-circle"},
    {"key": PAGE_VENDOR_PORTAL,       "label": "My Vendor Portal",     "icon": "bar-chart-2"},
    {"key": PAGE_PROCUREMENT,         "label": "Procurement",          "icon": "box"},
    {"key": PAGE_PURCHASE_ORDERS,     "label": "Purchase Orders",      "icon": "file-text"},
    {"key": PAGE_INVOICES,            "label": "Invoices",             "icon": "dollar-sign"},
    {"key": PAGE_CONTRACTS,           "label": "Contracts",            "icon": "clipboard"},
    {"key": PAGE_COMMUNICATION,       "label": "Communication",        "icon": "message-square"},
    {"key": PAGE_PERFORMANCE,         "label": "Performance",          "icon": "bar-chart-2"},
    {"key": PAGE_RISK_ANALYSIS,       "label": "Delivery Analytics",   "icon": "shield"},
    {"key": PAGE_ANALYTICS,           "label": "Analytics",            "icon": "trending-up"},
    {"key": PAGE_REPORTS,             "label": "Reports",              "icon": "book-open"},
    {"key": PAGE_NOTIFICATIONS,       "label": "Notifications",        "icon": "bell"},
    {"key": PAGE_SETTINGS,            "label": "Settings",             "icon": "settings"},
    {"key": PAGE_PROFILE,             "label": "Profile",              "icon": "user"},
]

# ── Role-specific grouped nav sections ───────────────────────────────────────
# Each role gets its own NAV_SECTIONS definition so the sidebar is perfectly
# tailored per role rather than relying on a single global filtered list.

_NAV_SECTIONS_ADMIN = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "VENDOR MANAGEMENT",
     "items": [
         {"key": PAGE_VENDOR_MANAGEMENT, "label": "Vendor Management",  "icon": "users"},
     ]},
    {"section": "PROCUREMENT",
     "items": [
         {"key": PAGE_PROCUREMENT,     "label": "Procurement",     "icon": "box"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Purchase Orders", "icon": "file-text"},
         {"key": PAGE_INVOICES,        "label": "Invoices",        "icon": "dollar-sign"},
         {"key": PAGE_CONTRACTS,       "label": "Contracts",       "icon": "clipboard"},
     ]},
    {"section": "COMMUNICATION",
     "items": [{"key": PAGE_COMMUNICATION, "label": "Messages", "icon": "message-square"}]},
    {"section": "INTELLIGENCE",
     "items": [
         {"key": PAGE_PERFORMANCE,   "label": "Performance",        "icon": "bar-chart-2"},
         {"key": PAGE_RISK_ANALYSIS, "label": "Delivery Analytics", "icon": "shield"},
         {"key": PAGE_ANALYTICS,     "label": "Analytics",          "icon": "trending-up"},
         {"key": PAGE_AUDIT,         "label": "Audit Trail",        "icon": "eye"},
     ]},
    {"section": "MANAGEMENT",
     "items": [
         {"key": PAGE_REPORTS,        "label": "Reports",       "icon": "book-open"},
         {"key": PAGE_NOTIFICATIONS,  "label": "Notifications", "icon": "bell"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_SETTINGS, "label": "Settings", "icon": "settings"},
         {"key": PAGE_PROFILE,  "label": "Profile",  "icon": "user"},
     ]},
]

# Procurement Manager: procurement-only, NO vendor management, NO vendor performance
_NAV_SECTIONS_PROCUREMENT = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "PROCUREMENT",
     "items": [
         {"key": PAGE_PROCUREMENT,     "label": "Procurement",     "icon": "box"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Purchase Orders", "icon": "file-text"},
         {"key": PAGE_INVOICES,        "label": "Invoices",        "icon": "dollar-sign"},
         {"key": PAGE_CONTRACTS,       "label": "Contracts",       "icon": "clipboard"},
     ]},
    {"section": "COMMUNICATION",
     "items": [{"key": PAGE_COMMUNICATION, "label": "Messages", "icon": "message-square"}]},
    {"section": "MANAGEMENT",
     "items": [
         {"key": PAGE_REPORTS,       "label": "Reports",       "icon": "book-open"},
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_SETTINGS, "label": "Settings", "icon": "settings"},
         {"key": PAGE_PROFILE,  "label": "Profile",  "icon": "user"},
     ]},
]

# Supply Chain Manager: has vendor management
_NAV_SECTIONS_SCM = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "VENDOR MANAGEMENT",
     "items": [
         {"key": PAGE_VENDOR_MANAGEMENT, "label": "Vendor Management", "icon": "users"},
     ]},
    {"section": "PROCUREMENT",
     "items": [
         {"key": PAGE_PROCUREMENT,     "label": "Procurement",     "icon": "box"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Purchase Orders", "icon": "file-text"},
         {"key": PAGE_CONTRACTS,       "label": "Contracts",       "icon": "clipboard"},
     ]},
    {"section": "COMMUNICATION",
     "items": [{"key": PAGE_COMMUNICATION, "label": "Messages", "icon": "message-square"}]},
    {"section": "INTELLIGENCE",
     "items": [
         {"key": PAGE_PERFORMANCE,   "label": "Performance",        "icon": "bar-chart-2"},
         {"key": PAGE_RISK_ANALYSIS, "label": "Delivery Analytics", "icon": "shield"},
         {"key": PAGE_ANALYTICS,     "label": "Analytics",          "icon": "trending-up"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
         {"key": PAGE_SETTINGS,      "label": "Settings",      "icon": "settings"},
         {"key": PAGE_PROFILE,       "label": "Profile",       "icon": "user"},
     ]},
]

# Vendor Manager — exact sidebar order requested:
# Dashboard | Register Vendor | Vendors | Approve Vendor | Vendor Categories | Overall Performance
_NAV_SECTIONS_VENDOR_MANAGER = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "VENDOR MANAGEMENT",
     "items": [
         {"key": PAGE_REGISTER_VENDOR,  "label": "Register Vendor",    "icon": "users"},
         {"key": PAGE_VENDORS,          "label": "Vendors",            "icon": "users"},
         {"key": PAGE_APPROVE_VENDOR,   "label": "Vendor Acceptance", "icon": "check-circle"},
         {"key": PAGE_VENDOR_CATEGORIES,"label": "Vendor Categories",  "icon": "tag"},
         {"key": PAGE_PERFORMANCE,      "label": "Overall Performance", "icon": "bar-chart-2"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
         {"key": PAGE_SETTINGS,      "label": "Settings",      "icon": "settings"},
         {"key": PAGE_PROFILE,       "label": "Profile",       "icon": "user"},
     ]},
]

# Individual Vendor: ONLY their own portal — no global analytics, no other vendors
_NAV_SECTIONS_VENDOR = [
    {"section": "MY PORTAL",
     "items": [
         {"key": PAGE_DASHBOARD,       "label": "Dashboard",     "icon": "grid"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Orders",        "icon": "file-text"},
         {"key": PAGE_COMMUNICATION,   "label": "Communication", "icon": "message-square"},
         {"key": PAGE_VENDOR_PORTAL,   "label": "Performance",   "icon": "bar-chart-2"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
         {"key": PAGE_SETTINGS,      "label": "Settings",      "icon": "settings"},
         {"key": PAGE_PROFILE,       "label": "Profile",       "icon": "user"},
     ]},
]

# Finance Officer: finance-focused, no vendor management
_NAV_SECTIONS_FINANCE = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "FINANCE",
     "items": [
         {"key": PAGE_INVOICES,        "label": "Invoices",        "icon": "dollar-sign"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Purchase Orders", "icon": "file-text"},
         {"key": PAGE_PROCUREMENT,     "label": "Procurement",     "icon": "box"},
         {"key": PAGE_CONTRACTS,       "label": "Contracts",       "icon": "clipboard"},
     ]},
    {"section": "INTELLIGENCE",
     "items": [
         {"key": PAGE_RISK_ANALYSIS, "label": "Risk Analysis", "icon": "shield"},
     ]},
    {"section": "MANAGEMENT",
     "items": [
         {"key": PAGE_REPORTS,       "label": "Reports",       "icon": "book-open"},
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_SETTINGS, "label": "Settings", "icon": "settings"},
         {"key": PAGE_PROFILE,  "label": "Profile",  "icon": "user"},
     ]},
]

# Auditor: read-only across all sections
_NAV_SECTIONS_AUDITOR = [
    {"section": None,
     "items": [{"key": PAGE_DASHBOARD, "label": "Dashboard", "icon": "grid"}]},
    {"section": "VENDOR MANAGEMENT",
     "items": [
         {"key": PAGE_VENDOR_MANAGEMENT, "label": "Vendor Management", "icon": "users"},
     ]},
    {"section": "PROCUREMENT",
     "items": [
         {"key": PAGE_PROCUREMENT,     "label": "Procurement",     "icon": "box"},
         {"key": PAGE_PURCHASE_ORDERS, "label": "Purchase Orders", "icon": "file-text"},
         {"key": PAGE_INVOICES,        "label": "Invoices",        "icon": "dollar-sign"},
         {"key": PAGE_CONTRACTS,       "label": "Contracts",       "icon": "clipboard"},
     ]},
    {"section": "COMMUNICATION",
     "items": [{"key": PAGE_COMMUNICATION, "label": "Messages", "icon": "message-square"}]},
    {"section": "INTELLIGENCE",
     "items": [
         {"key": PAGE_PERFORMANCE,   "label": "Performance",        "icon": "bar-chart-2"},
         {"key": PAGE_RISK_ANALYSIS, "label": "Delivery Analytics", "icon": "shield"},
         {"key": PAGE_ANALYTICS,     "label": "Analytics",          "icon": "trending-up"},
         {"key": PAGE_AUDIT,         "label": "Audit Trail",        "icon": "eye"},
     ]},
    {"section": "MANAGEMENT",
     "items": [
         {"key": PAGE_REPORTS,       "label": "Reports",       "icon": "book-open"},
         {"key": PAGE_NOTIFICATIONS, "label": "Notifications", "icon": "bell"},
     ]},
    {"section": "ACCOUNT",
     "items": [
         {"key": PAGE_SETTINGS, "label": "Settings", "icon": "settings"},
         {"key": PAGE_PROFILE,  "label": "Profile",  "icon": "user"},
     ]},
]

# ── Role → Nav Sections Map ───────────────────────────────────────────────────
_ROLE_NAV_SECTIONS: Dict[str, list] = {
    ROLE_ADMINISTRATOR:        _NAV_SECTIONS_ADMIN,
    ROLE_PROCUREMENT_MANAGER:  _NAV_SECTIONS_PROCUREMENT,
    ROLE_SUPPLY_CHAIN_MANAGER: _NAV_SECTIONS_SCM,
    ROLE_VENDOR_MANAGER:       _NAV_SECTIONS_VENDOR_MANAGER,
    ROLE_VENDOR:               _NAV_SECTIONS_VENDOR,
    ROLE_FINANCE_OFFICER:      _NAV_SECTIONS_FINANCE,
    ROLE_AUDITOR:              _NAV_SECTIONS_AUDITOR,
}


def get_navigation_items(role: str) -> List[Dict]:
    """Return the ordered list of navigation items accessible to the given role."""
    allowed = get_allowed_pages(role)
    return [item for item in NAV_ITEMS if item["key"] in allowed]


def get_navigation_sections(role: str) -> List[Dict]:
    """
    Return the grouped navigation sections for the given role.

    Uses role-specific section definitions so each role gets a perfectly
    tailored sidebar rather than a one-size-fits-all filtered list.
    Falls back to permission-filtered generic sections if role is unknown.
    """
    role_sections = _ROLE_NAV_SECTIONS.get(role)
    if role_sections is not None:
        # Filter each section's items against allowed pages as a safety net
        allowed = get_allowed_pages(role)
        result = []
        for sec in role_sections:
            filtered_items = [it for it in sec["items"] if it["key"] in allowed]
            if filtered_items:
                result.append({"section": sec["section"], "items": filtered_items})
        return result

    # Generic fallback for any unrecognised role
    allowed = get_allowed_pages(role)
    fallback_sections = _NAV_SECTIONS_ADMIN  # most permissive as template
    result = []
    for sec in fallback_sections:
        filtered_items = [it for it in sec["items"] if it["key"] in allowed]
        if filtered_items:
            result.append({"section": sec["section"], "items": filtered_items})
    return result
