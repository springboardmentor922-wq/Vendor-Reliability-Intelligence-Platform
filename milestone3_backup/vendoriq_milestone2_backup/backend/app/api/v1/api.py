from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    vendors,
    procurement,
    purchase_orders,
    contracts,
    communication,
    dashboard,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(vendors.router, prefix="/vendors", tags=["Vendor Management"])
api_router.include_router(procurement.router, prefix="/procurement", tags=["Procurement Management"])
api_router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["Purchase Orders"])
api_router.include_router(contracts.router, prefix="/contracts", tags=["Contracts & Compliance"])
api_router.include_router(communication.router, prefix="/communication", tags=["Communication"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
