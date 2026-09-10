from fastapi import FastAPI
from app.core.database import Base, engine
from app.core.config import settings
import app.models  # ensures all models are registered
from app.routers import auth, vendors, purchase_orders, contracts, performance

app = FastAPI(title=settings.PROJECT_NAME)

# Create all tables in the database (fine for dev; we'll use Alembic properly later)
Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(vendors.router)
app.include_router(purchase_orders.router)
app.include_router(contracts.router)
app.include_router(performance.router)


@app.get("/")
def root():
    return {"message": "VendorIQ API is running"}