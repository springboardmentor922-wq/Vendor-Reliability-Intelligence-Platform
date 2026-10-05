import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.endpoints import auth, vendors, procurement, contracts, analytics, notifications
from app.db.session import engine, Base, SessionLocal
from app.db.init_db import init_db

# Automatically create tables on startup if they don't exist
# This avoids needing manual migrations for SQLite local runs
Base.metadata.create_all(bind=engine)

# Seed initial accounts for all 6 roles and sample data
db = SessionLocal()
try:
    init_db(db)
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API router registrations
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(vendors.router, prefix=f"{settings.API_V1_STR}/vendors", tags=["Vendors"])
app.include_router(procurement.router, prefix=f"{settings.API_V1_STR}/procurement", tags=["Procurement"])
app.include_router(contracts.router, prefix=f"{settings.API_V1_STR}/contracts", tags=["Contracts"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Analytics"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["Notifications"])

# Serve static frontend files
# We verify if frontend directory exists before mounting to avoid errors if it is built later
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to VendorIQ API. Frontend static directory not found."}
