"""Vendor Reliability Intelligence Platform - FastAPI application entry point."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.analytics import router as analytics_router
from api.auth import router as auth_router
from api.communication import router as communication_router
from api.contracts import router as contracts_router
from api.dashboard import router as dashboard_router
from api.invoices import router as invoices_router
from api.notifications import router as notifications_router
from api.procurement_requests import router as procurement_requests_router
from api.purchase_orders import router as purchase_orders_router
from api.reliability import router as reliability_router
from api.reports import router as reports_router
from api.users import router as users_router
from api.vendor_performance import router as vendor_performance_router
from api.vendors import router as vendors_router
from config import settings
from database import get_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Vendor reliability, procurement, purchase order, contract and "
        "communication management API, with performance monitoring, "
        "six-factor reliability scoring, delivery-delay prediction, "
        "interactive analytics and PDF / Excel reporting."
    ),
    swagger_ui_parameters={"persistAuthorization": True}
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# STATIC FILES (shared attachments)
# --------------------------------------------------

app.mount(
    "/uploads",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="uploads"
)


# --------------------------------------------------
# API ROUTES
# --------------------------------------------------

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(dashboard_router)
app.include_router(vendors_router)
app.include_router(procurement_requests_router)
app.include_router(purchase_orders_router)
app.include_router(invoices_router)
app.include_router(contracts_router)
app.include_router(communication_router)
app.include_router(notifications_router)
app.include_router(vendor_performance_router)
app.include_router(reliability_router)
app.include_router(analytics_router)
app.include_router(reports_router)


# --------------------------------------------------
# ROOT / HEALTH
# --------------------------------------------------

@app.on_event("startup")
def warm_prediction_model():
    """Load the delay model at boot rather than on the first request.

    Deserialising the artifact takes a few seconds; doing it lazily made
    whichever request arrived first pay that cost.
    """

    from ml import predictor

    if predictor.is_ready():
        print(f"[startup] delay model loaded: {predictor.model_version()}")
    else:
        print(
            "[startup] no delay model artifact found - predictions will use "
            "the heuristic fallback. Run 'python -m ml.train_delay_model'."
        )


@app.get("/", tags=["System"])
def root():
    return {
        "message": f"{settings.PROJECT_NAME} API is running",
        "version": settings.VERSION,
        "docs": "/docs"
    }


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy"}


@app.get("/database-test", tags=["System"])
def database_test(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"database": "connected", "status": "success"}
    except Exception as exc:
        return {"database": "connection failed", "error": str(exc)}
