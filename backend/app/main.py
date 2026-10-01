import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select

from app.config import settings
from app.database import check_db_health, redis_manager, AsyncSessionLocal
from app.models import Role, User, Vendor
from app.security import get_password_hash
from app.routers import auth, admin, procurement, vendors, purchase_orders, contracts, notifications, performance, dashboard, reports, communication

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

ROLES_LIST = [
    "Administrator",
    "Procurement Manager",
    "Supply Chain Manager",
    "Finance Officer",
    "Vendor",
    "Auditor"
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing application and seeding foundational data...")
    # Ensure upload directories exist
    base_dir = os.path.dirname(os.path.dirname(__file__))
    os.makedirs(os.path.join(base_dir, "uploads", "po_documents"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "uploads", "contracts"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "uploads", "communication"), exist_ok=True)

    try:
        async with AsyncSessionLocal() as db:
            # 1. Seed Roles
            for r_name in ROLES_LIST:
                stmt = select(Role).where(Role.name == r_name)
                res = await db.execute(stmt)
                if not res.scalar_one_or_none():
                    db.add(Role(name=r_name))
            await db.commit()

            # 2. Seed Default Admin User
            admin_stmt = select(User).where(User.email == "admin@example.com")
            res = await db.execute(admin_stmt)
            if not res.scalar_one_or_none():
                admin_role_stmt = select(Role).where(Role.name == "Administrator")
                admin_role = (await db.execute(admin_role_stmt)).scalar_one()
                admin_user = User(
                    email="admin@example.com",
                    hashed_password=get_password_hash("Admin@123456"),
                    full_name="System Administrator",
                    status="APPROVED",
                    roles=[admin_role]
                )
                db.add(admin_user)
                await db.commit()
                logger.info("Default administrator account created: admin@example.com / Admin@123456")

            # 3. Seed Initial Sample Vendor if none exist
            v_stmt = select(Vendor).limit(1)
            v_res = await db.execute(v_stmt)
            if not v_res.scalar_one_or_none():
                v = Vendor(
                    company_name="Apex Global Logistics",
                    registration_no="VEND-2026-001",
                    category="Logistics & Freight",
                    status="ACTIVE"
                )
                db.add(v)
                await db.commit()
    except Exception as e:
        logger.warning("Startup seeding check encountered an issue (tables might need migration first): %s", e)

    yield
    logger.info("Application shutting down...")

app = FastAPI(
    title="Procurement & Vendor Reliability Platform API",
    version="2.0.0",
    lifespan=lifespan
)

from app.telemetry import record_response_time
import time as _time

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Telemetry Middleware: Track API response time
@app.middleware("http")
async def track_response_time(request, call_next):
    start = _time.monotonic()
    response = await call_next(request)
    elapsed_ms = (_time.monotonic() - start) * 1000.0
    record_response_time(elapsed_ms)
    return response

# Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(procurement.router)
app.include_router(procurement.pr_router)
app.include_router(performance.router)
app.include_router(vendors.router)
app.include_router(purchase_orders.router)
app.include_router(contracts.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(reports.analytics_router)
app.include_router(communication.router)

@app.get("/health", tags=["Health"])
async def health_check():
    db_healthy = await check_db_health()
    redis_healthy = await redis_manager.is_connected()
    return {
        "status": "healthy" if db_healthy else "degraded",
        "database": "connected" if db_healthy else "disconnected",
        "redis": "connected" if redis_healthy else "fallback_in_memory_mode"
    }

@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "Procurement Management API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=False)


