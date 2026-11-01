from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from app.db.seed import seed_database

# Import routers
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.routers.requisitions import router as requisitions_router
from app.routers.procurement import router as procurement_router
from app.routers.finance import router as finance_router
from app.routers.purchase_orders import router as po_router
from app.routers.deliveries import router as deliveries_router
from app.routers.vendors import router as vendors_router
from app.routers.audit import router as audit_router
from app.routers.users import router as users_router
from app.routers.contracts import router as contracts_router
from app.routers.invoices import router as invoices_router
from app.routers.communications import router as comms_router
from app.routers.notifications import router as notif_router
from app.routers.dashboard import router as dashboard_router

from app.db.migrate_columns import run_sqlite_migrations

# Initialize DB tables & seed
Base.metadata.create_all(bind=engine)
try:
    run_sqlite_migrations()
except Exception as e:
    print("Migration notice:", e)

try:
    seed_database()
except Exception as e:
    print("Database seeding notice:", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for Vendor Reliability & Risk Management System with Strict RBAC"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Mount Routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(requisitions_router)
app.include_router(procurement_router)
app.include_router(finance_router)
app.include_router(po_router)
app.include_router(deliveries_router)
app.include_router(vendors_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(contracts_router)
app.include_router(invoices_router)
app.include_router(comms_router)
app.include_router(notif_router)
app.include_router(dashboard_router)

@app.get("/")
def home():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "Operational",
        "roles": settings.ROLES,
        "lifecycle_stages": [
            "User Registration & Admin Verification",
            "Requirement Identification & Purchase Requisition",
            "Procurement & Vendor Selection",
            "Finance Approval",
            "Purchase Order Creation & Issuance (SCM)",
            "Vendor Fulfillment & Dispatch",
            "Delivery Tracking & Confirmation (SCM)",
            "3-Way Match Invoice Verification & Payment (Finance)",
            "Audit & Discrepancy Review",
            "Vendor Reliability & Risk Analysis"
        ]
    }
