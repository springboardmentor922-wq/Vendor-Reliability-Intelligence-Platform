"""
config/settings.py
------------------
Centralized configuration loader for the VendorPulse Procurement Platform.
Reads all settings from environment variables / .env file.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Load .env from project root ──────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    # Fall back to .env.example so the app at least starts with defaults
    load_dotenv(BASE_DIR / ".env.example")


# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "vendor_reliability_db")

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY", "change-me-in-production-use-a-real-secret"
)
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES: int = int(os.getenv("JWT_EXPIRATION_MINUTES", "480"))

# ── Application ───────────────────────────────────────────────────────────────
APP_NAME: str = os.getenv("APP_NAME", "VendorPulse")
APP_ENV: str = os.getenv("APP_ENV", "development")
APP_DEBUG: bool = os.getenv("APP_DEBUG", "true").lower() == "true"
APP_VERSION: str = os.getenv("APP_VERSION", "3.0.0")

# ── Security ──────────────────────────────────────────────────────────────────
MIN_PASSWORD_LENGTH: int = int(os.getenv("MIN_PASSWORD_LENGTH", "8"))
SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "480"))

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE: str = os.getenv("LOG_FILE", str(BASE_DIR / "logs" / "app.log"))

# ── Dataset Paths ─────────────────────────────────────────────────────────────
DATACO_DATASET_PATH = BASE_DIR / "data" / "DataCoSupplyChainDataset - DataCoSupplyChainDataset.csv"

# ── MongoDB Collection Names ──────────────────────────────────────────────────
COLLECTION_USERS = "users"
COLLECTION_VENDORS = "vendors"
COLLECTION_PROCUREMENT_REQUESTS = "procurement_requests"
COLLECTION_PURCHASE_ORDERS = "purchase_orders"
COLLECTION_DELIVERIES = "deliveries"
COLLECTION_CONTRACTS = "contracts"
COLLECTION_COMMUNICATIONS = "communications"
COLLECTION_NOTIFICATIONS = "notifications"
COLLECTION_AUDIT_LOGS = "audit_logs"
COLLECTION_INVOICES = "invoices"
COLLECTION_PAYMENTS = "payments"

# ── Vendor Status Options ─────────────────────────────────────────────────────
VENDOR_STATUS_OPTIONS = ["Active", "Inactive", "Suspended", "Pending"]
VENDOR_APPROVAL_STATUS = ["Pending", "Approved", "Rejected"]
# ── Canonical Vendor Categories ─────────────────────────────────────────────
# These are the EXACT strings stored in the DB "category" field.
# They are also used for RBAC isolation: procurement requests select one of
# these categories, and only vendors in that category can be assigned.
VENDOR_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment Vendors",
    "IT Vendors",
    "Service Providers",
    "Logistics Partners",
    "Maintenance Vendors",
]

# Human-readable labels (identity mapping — keys ARE the display names)
VENDOR_CATEGORY_LABELS = {
    "Raw Material Suppliers": "Raw Material Suppliers",
    "Equipment Vendors":      "Equipment Vendors",
    "IT Vendors":             "IT Vendors",
    "Service Providers":      "Service Providers",
    "Logistics Partners":     "Logistics Partners",
    "Maintenance Vendors":    "Maintenance Vendors",
}

# Category color palette for dashboards
VENDOR_CATEGORY_COLORS = {
    "Raw Material Suppliers": "#2D6A4A",
    "Equipment Vendors":      "#2E4B7A",
    "IT Vendors":             "#1677E8",
    "Service Providers":      "#B08D57",
    "Logistics Partners":     "#6B3DA6",
    "Maintenance Vendors":    "#8B3038",
}

# ── Procurement Status Options — Workflow spec ──────────────────────────────────
PROCUREMENT_STATUS_OPTIONS = [
    "Pending",
    "Approved",
    "Vendor Assigned",
    "Vendor Accepted",
    "Vendor Rejected",
    "Ordered",
    "Delivered",
    "Completed",
    "Cancelled",
    "Rejected",
]

# ── Vendor Response Status ────────────────────────────────────────────────────
VENDOR_RESPONSE_STATUS_OPTIONS = ["Pending", "Accepted", "Rejected"]

# ── Purchase Order Status — Workflow lifecycle ────────────────────────────────
PO_STATUS_OPTIONS = [
    "Pending",
    "Approved",
    "Ordered",
    "Delivered",
    "Completed",
    "Cancelled",
]

# ── Invoice Status ────────────────────────────────────────────────────────────
INVOICE_STATUS_OPTIONS = ["Pending", "Submitted", "Approved", "Rejected", "Correction Required"]

# ── Finance Verification Status ───────────────────────────────────────────────
INVOICE_VERIFICATION_STATUS = ["Pending", "Approved", "Rejected", "Correction Required"]

# ── Payment Status ────────────────────────────────────────────────────────────
INVOICE_PAYMENT_STATUS = ["Unpaid", "Approved for Payment", "Settled", "On Hold"]

# ── Contract Status ───────────────────────────────────────────────────────────
CONTRACT_COMPLIANCE_STATUS = ["Compliant", "Non-Compliant", "Under Review", "Expired"]

CONTRACT_STATUS_OPTIONS = [
    "Draft",
    "Active",
    "Expiring Soon",
    "Expired",
    "Renewed",
    "Terminated",
    "Under Review",
]

CONTRACT_TYPE_OPTIONS = [
    "Service Agreement",
    "Supply Agreement",
    "Master Service Agreement",
    "NDA",
    "SLA",
    "Framework Agreement",
    "Maintenance Agreement",
    "Other",
]

# ── Communication ─────────────────────────────────────────────────────────────
COMMUNICATION_THREAD_TYPES = ["vendor", "procurement", "purchase_order", "general"]

# ── DataCo Product Categories (from dataset) ──────────────────────────────────
DATACO_CATEGORIES = [
    "Sporting Goods",
    "Apparel",
    "Electronics",
    "Furniture",
    "Books",
    "Health",
    "Beauty",
    "Toys",
    "Music",
    "Movies",
    "Outdoors",
    "Pet Supplies",
    "Baby",
    "Grocery",
    "Automotive",
    "Tools",
    "Garden",
    "Other",
]

# ── DataCo Markets (from dataset) ─────────────────────────────────────────────
DATACO_MARKETS = [
    "Pacific Asia",
    "Europe",
    "USCA",
    "LATAM",
    "Africa",
]
