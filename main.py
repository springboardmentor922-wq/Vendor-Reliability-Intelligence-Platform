from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.core.config import settings
import app.models  # ensures all models are registered
from app.routers import (
    auth,
    vendors,
    procurement_requests,
    purchase_orders,
    contracts,
    performance,
    dashboard,
    notifications,
)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables in the database (fine for dev; we'll use Alembic properly later)
Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(procurement_requests.router)
app.include_router(purchase_orders.router)
app.include_router(contracts.router)
app.include_router(performance.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {"message": "VendorIQ API is running"}