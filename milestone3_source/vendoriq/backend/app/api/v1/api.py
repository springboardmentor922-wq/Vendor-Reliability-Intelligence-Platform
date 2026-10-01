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
    performance,
    reliability,
    analytics,
    notifications,
    reports,
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
api_router.include_router(performance.router, prefix="/performance", tags=["Vendor Performance"])
api_router.include_router(reliability.router, prefix="/reliability", tags=["Vendor Reliability"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics Dashboards"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notification System"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Export"])
