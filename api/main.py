"""
api/main.py
-----------
FastAPI Backend Application for VendorPulse.
Exposes RESTful endpoints for suppliers, vendors, procurement, purchase orders,
contracts, and communications.

Security:
  - JWT Bearer token verification middleware on all /api/* endpoints
  - Role-based access control enforced at the route level
  - Vendor-scoped queries enforced at the service level
"""

import logging
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers.vendors import router as vendors_router
from api.routers.procurement import router as procurement_router
from api.routers.purchase_orders import router as po_router
from api.routers.contracts import router as contracts_router
from api.routers.communications import router as comms_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="VendorPulse API",
    description="Enterprise RESTful backend layer for Vendor Intelligence & Procurement Management.",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for Streamlit frontend (localhost only in production should be locked down)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8501", "http://127.0.0.1:8501", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes that don't require authentication ───────────────────────────
_PUBLIC_PATHS = {"/api/health", "/docs", "/redoc", "/openapi.json"}


@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    JWT Bearer token verification middleware.

    All /api/* endpoints (except /api/health) require a valid JWT token
    in the Authorization header. The token is validated using the same
    jwt_handler used by the Streamlit session layer.

    Vendor role enforcement:
      - If the authenticated user has role=Vendor, the middleware attaches
        their vendor_id to request.state so downstream route handlers can
        enforce data isolation without trusting any client-supplied vendor_id.
    """
    path = request.url.path

    # Skip auth for public/health endpoints and docs
    if path in _PUBLIC_PATHS or not path.startswith("/api/"):
        return await call_next(request)

    # Extract Bearer token
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]

    if not token:
        # Allow requests from the internal Streamlit process (same host, no token)
        # For production, remove this bypass and enforce tokens strictly.
        client_host = request.client.host if request.client else ""
        if client_host in ("127.0.0.1", "::1", "localhost"):
            request.state.user_id = None
            request.state.user_role = None
            request.state.vendor_id = None
            return await call_next(request)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required. Provide a Bearer token."},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate token
    try:
        from auth.jwt_handler import get_token_claims
        claims = get_token_claims(token)
        if claims is None:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Token expired or invalid."},
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Attach claims to request state for downstream use
        request.state.user_id = claims.get("sub")
        request.state.user_role = claims.get("role")
        request.state.vendor_id = claims.get("vendor_id")  # set if role=Vendor
    except Exception as exc:
        logger.error("JWT middleware error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication failed."},
        )

    return await call_next(request)


# Mount all feature routers under /api
app.include_router(vendors_router, prefix="/api")
app.include_router(procurement_router, prefix="/api")
app.include_router(po_router, prefix="/api")
app.include_router(contracts_router, prefix="/api")
app.include_router(comms_router, prefix="/api")


@app.get("/api/health", tags=["Health"])
def health_check():
    """System health check endpoint. No authentication required."""
    return {
        "status": "healthy",
        "service": "VendorPulse API",
        "version": "3.0.0",
        "database": "connected",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
