from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

from app.routers import (
    auth,
    vendor,
    procurement,
    purchase_order,
    vendor_performance,
    vendor_reliability,
    risk_analysis,
    procurement_recommendation,
)

from app.routers.vendor_approval import router as vendor_approval_router
from app.routers.contract import router as contract_router
from app.routers.communication import router as communication_router
from app.routers.reliability_score import router as reliability_score_router
from app.routers.certification import router as certification_router
from app.routers.notification import router as notification_router
from app.routers.activity_log import router as activity_log_router

from app.database.connection import engine
from app.database.base import Base

from app.models.user import User
from app.models.vendor_approval import VendorApproval
from app.models.contract import Contract
from app.models.certification import Certification
from app.models.notification import Notification
from app.models.activity_log import ActivityLog
from app.models.vendor_reliability import VendorReliability
from app.models.vendor_performance import VendorPerformance
from app.models.risk_analysis import RiskAnalysis
from app.models.procurement_recommendation import ProcurementRecommendation


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Vendor Reliability Intelligence & Procurement Risk Management Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)


origins = settings.CORS_ORIGINS

if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(vendor.router)
app.include_router(procurement.router)
app.include_router(purchase_order.router)
app.include_router(vendor_performance.router)
app.include_router(vendor_reliability.router)
app.include_router(risk_analysis.router)
app.include_router(procurement_recommendation.router)
app.include_router(vendor_approval_router)
app.include_router(contract_router)
app.include_router(communication_router)
app.include_router(reliability_score_router)
app.include_router(certification_router)
app.include_router(notification_router)
app.include_router(activity_log_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
def root_redirect():
    return {
        "message": "Welcome to Vendor Reliability Intelligence API",
        "docs": "/docs",
        "health": "/health",
    }