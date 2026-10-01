from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.db.session_dep import get_db
from app.db.init_db import init_db
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "REST API for the Vendor Reliability Intelligence & Procurement Risk "
        "Management Platform (VendorIQ). Covers Milestones 1-3: authentication "
        "and RBAC, vendor/procurement management, purchase orders, contracts and "
        "compliance, communication, vendor performance, reliability scoring, "
        "analytics, notifications, and reporting."
    ),
    version="0.3.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        init_db(db)
    finally:
        db.close()


@app.get("/", tags=["Health"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "running",
        "docs": "/api/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.API_V1_STR)
