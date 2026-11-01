# Backward compatibility wrapper for models
from app.models import (
    Base, User, PasswordResetToken, Vendor, VendorCategory, VendorContact,
    ProcurementRequest, PurchaseOrder, PurchaseOrderItem, Contract, Invoice,
    CommunicationMessage, AuditLog, Notification
)
