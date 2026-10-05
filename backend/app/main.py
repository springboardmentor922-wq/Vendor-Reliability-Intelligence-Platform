from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.vendors import router as vendors_router
from app.api.procurement import router as procurement_router
from app.api.purchase_orders import router as purchase_orders_router
from app.api.contracts import router as contracts_router
from app.api.communication import router as communication_router
from app.api.vendor_performance import router as vendor_performance_router
from app.api.reliability import router as reliability_router
from app.api.analytics import router as analytics_router
from app.api.notifications import router as notifications_router
from app.api.reports import router as reports_router
from app.api.dataset_analytics import router as dataset_analytics_router

from app.core.config import settings
from app.database import Base, engine

from app.models.password_reset import PasswordResetToken
from app.api.risk_alerts import router as risk_alerts_router
from app.models import (
    User,
    Vendor,
    ProcurementRequest,
    PurchaseOrder,
    PurchaseOrderItem,
    Invoice,
)

from app.models.vendor import VendorStatusHistory

from app.models.contract import (
    Contract,
    Certification,
    VendorDocument,
)

from app.models.communication import Communication
from app.models.vendor_performance import VendorPerformance
from app.models.notification import Notification


# Keep all imported models registered with SQLAlchemy
_ = (
    User,
    Vendor,
    VendorStatusHistory,
    ProcurementRequest,
    PurchaseOrder,
    PurchaseOrderItem,
    Invoice,
    Contract,
    Certification,
    VendorDocument,
    Communication,
    VendorPerformance,
    Notification,
    PasswordResetToken,
)


# Create database tables if they do not already exist
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="VendorIQ API",
    version="1.0.0",
)


allowed_origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(vendors_router)
app.include_router(procurement_router)
app.include_router(purchase_orders_router)
app.include_router(contracts_router)
app.include_router(communication_router)
app.include_router(vendor_performance_router)
app.include_router(reliability_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(dataset_analytics_router)
app.include_router(risk_alerts_router)

@app.get("/")
def root():
    return {
        "message": "VendorIQ API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }