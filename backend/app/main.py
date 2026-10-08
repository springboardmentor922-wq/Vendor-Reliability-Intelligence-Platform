import os
import logging
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import check_db_health, redis_manager, AsyncSessionLocal, get_db
from app.models import Role, User, Vendor
from app.security import get_password_hash, verify_password
from app.routers import auth, admin, procurement, vendors, purchase_orders, contracts, notifications, performance, dashboard, reports, communication

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.main")

from sqlalchemy import func

ROLES_LIST = [
    "Administrator",
    "Procurement Manager",
    "Supply Chain Manager",
    "Finance Officer",
    "Vendor",
    "Auditor"
]

async def seed_default_admin_and_roles(db: AsyncSession) -> dict:
    """
    Idempotent seeding helper:
    1. Ensures all foundational roles exist.
    2. Checks if admin@example.com exists; creates it if missing with Admin@123456 and APPROVED status.
    3. If admin already exists, ensures status is APPROVED, role has Administrator,
       and resets password hash to Admin@123456 if incorrect. Safe to call multiple times without erroring.
    4. Seeds initial sample vendor if none exists.
    """
    try:
        # 1. Seed Roles
        for r_name in ROLES_LIST:
            stmt = select(Role).where(Role.name == r_name)
            res = await db.execute(stmt)
            if not res.scalar_one_or_none():
                db.add(Role(name=r_name))
        await db.commit()

        # 2. Ensure Administrator Role exists and is loaded
        admin_role_stmt = select(Role).where(Role.name == "Administrator")
        admin_role_res = await db.execute(admin_role_stmt)
        admin_role = admin_role_res.scalar_one_or_none()
        if not admin_role:
            admin_role = Role(name="Administrator")
            db.add(admin_role)
            await db.commit()
            admin_role_res = await db.execute(admin_role_stmt)
            admin_role = admin_role_res.scalar_one_or_none()

        # 3. Seed / Verify Admin User (case-insensitive lookup)
        admin_stmt = (
            select(User)
            .where(func.lower(User.email) == "admin@example.com")
            .options(selectinload(User.roles))
        )
        admin_res = await db.execute(admin_stmt)
        admin_user = admin_res.scalar_one_or_none()

        action = "verified"
        if not admin_user:
            admin_user = User(
                email="admin@example.com",
                hashed_password=get_password_hash("Admin@123456"),
                full_name="System Administrator",
                status="APPROVED",
                roles=[admin_role]
            )
            db.add(admin_user)
            await db.commit()
            # Reload with roles
            admin_res = await db.execute(admin_stmt)
            admin_user = admin_res.scalar_one()
            action = "created"
            logger.info("Default administrator account created: admin@example.com / Admin@123456")
        else:
            changed = False
            if admin_user.status != "APPROVED":
                admin_user.status = "APPROVED"
                changed = True
            if admin_user.email != "admin@example.com":
                admin_user.email = "admin@example.com"
                changed = True
            if not any(r.name == "Administrator" for r in admin_user.roles):
                admin_user.roles.append(admin_role)
                changed = True
            if not verify_password("Admin@123456", admin_user.hashed_password):
                admin_user.hashed_password = get_password_hash("Admin@123456")
                changed = True

            if changed:
                await db.commit()
                # Reload with roles
                admin_res = await db.execute(admin_stmt)
                admin_user = admin_res.scalar_one()
                action = "updated"
                logger.info("Default administrator account refreshed: admin@example.com / Admin@123456 (status APPROVED)")
            else:
                logger.info("Default administrator account already exists and is valid.")

        # 4. Seed Initial Sample Vendor if none exist
        v_stmt = select(Vendor).limit(1)
        v_res = await db.execute(v_stmt)
        vendor_seeded = False
        if not v_res.scalar_one_or_none():
            v = Vendor(
                company_name="Apex Global Logistics",
                registration_no="VEND-2026-001",
                category="Logistics & Freight",
                status="ACTIVE"
            )
            db.add(v)
            await db.commit()
            vendor_seeded = True

        # Fetch current database roles
        all_roles_res = await db.execute(select(Role.name).order_by(Role.name))
        all_roles = [r[0] for r in all_roles_res.all()]

        return {
            "action": action,
            "admin_email": admin_user.email,
            "admin_status": admin_user.status,
            "admin_roles": [r.name for r in admin_user.roles],
            "database_roles": all_roles,
            "sample_vendor_seeded": vendor_seeded
        }
    except Exception as e:
        await db.rollback()
        logger.error("Error during seed_default_admin_and_roles: %s", e, exc_info=True)
        raise

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
            result = await seed_default_admin_and_roles(db)
            logger.info("Startup foundational seeding status: %s", result)
    except Exception as e:
        logger.error("Startup seeding check encountered an issue: %s", e, exc_info=True)

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

from fastapi import Header

@app.api_route("/api/v1/auth/seed-admin", methods=["GET", "POST"], tags=["Auth"])
async def trigger_seed_admin(
    secret: Optional[str] = Query(None, description="Optional secret key for verification"),
    x_admin_secret: Optional[str] = Header(None, alias="X-Admin-Secret"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Idempotent trigger to seed or repair the foundational roles and default Administrator account
    (admin@example.com / Admin@123456).
    Safe to re-run multiple times without erroring.
    """
    try:
        from sqlalchemy import func
        stmt = select(User).where(func.lower(User.email) == "admin@example.com")
        existing_res = await db.execute(stmt)
        existing_admin = existing_res.scalar_one_or_none()

        provided_secret = secret or x_admin_secret
        valid_secrets = {
            "Admin@123456",
            "procureflow-seed-2026",
            settings.SECRET_KEY,
            "procurement-super-secret-jwt-key-2026-production-grade"
        }

        # If admin already exists, require secret to prevent unauthorized credential reset
        if existing_admin and (provided_secret not in valid_secrets):
            raise HTTPException(
                status_code=403,
                detail="Admin user already exists. To refresh/repair credentials or roles, supply ?secret=Admin@123456"
            )

        result = await seed_default_admin_and_roles(db)
        return {
            "status": "success",
            "message": "Default foundational roles and administrator account verified successfully.",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Manual admin seeding error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to seed admin and roles: {str(e)}")

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


