"""
VendorIQ Backend Main Application
FastAPI server connecting REST endpoints, database, and frontend static assets.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend.database import init_db
from backend.routes.auth_routes import router as auth_router
from backend.routes.vendor_routes import router as vendor_router
from backend.routes.procurement_routes import router as procurement_router
from backend.routes.performance_routes import router as performance_router
from backend.routes.compliance_routes import router as compliance_router
from backend.routes.communication_routes import router as communication_router
from backend.routes.dashboard_routes import router as dashboard_router
from backend.routes.report_routes import router as report_router
from backend.routes.audit_routes import router as audit_router

app = FastAPI(
    title="VendorIQ - Predictive Vendor Intelligence Platform",
    description="Enterprise Supplier Risk and Performance Intelligence System",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(vendor_router)
app.include_router(procurement_router)
app.include_router(performance_router)
app.include_router(compliance_router)
app.include_router(communication_router)
app.include_router(dashboard_router)
app.include_router(report_router)
app.include_router(audit_router)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "VendorIQ", "version": "2.0.0"}

# Mount frontend static directory
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
