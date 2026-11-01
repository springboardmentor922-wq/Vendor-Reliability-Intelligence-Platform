from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import get_db, get_current_user, require_roles_strict
from app.models.user import User
from app.models.procurement import ProcurementRequest
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.payment import Payment
from app.models.vendor import Vendor
from app.models.vendor_metrics import VendorRisk
from app.models.communication import AuditLog
from app.services.notification_service import send_notification

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

class UserApprovalRequest(BaseModel):
    assigned_role: Optional[str] = None # Admin can assign/override role during approval
    assigned_category: Optional[str] = None # Admin can confirm/assign category for Vendors
    notes: Optional[str] = None

class UserRejectionRequest(BaseModel):
    rejection_reason: str

class UserStatusToggle(BaseModel):
    is_active: bool

@router.get("/pending-registrations")
def get_pending_registrations(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """Admin views all pending user registrations requiring verification."""
    pending = db.query(User).filter(User.approval_status == "PENDING").order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "company": u.company,
            "department": u.department,
            "vendor_category": u.vendor_category,
            "product_service": u.product_service,
            "phone": u.phone,
            "created_at": u.created_at,
            "approval_status": u.approval_status
        }
        for u in pending
    ]

@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: int,
    payload: UserApprovalRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """
    Admin verifies user information, assigns/confirms role, and approves access.
    Step 3, 4, 5 of complete lifecycle.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prev_role = user.role
    if payload.assigned_role:
        user.role = payload.assigned_role

    user.approval_status = "APPROVED"
    user.is_active = True
    user.rejection_reason = None
    user.updated_at = datetime.utcnow()

    # Automatically provision / activate Vendor profile if role is Vendor
    if user.role == "Vendor":
        from app.models.vendor import Vendor, VendorContact
        from app.models.vendor_metrics import VendorPerformance
        from app.models.delivery import Delivery
        target_category = payload.assigned_category or user.vendor_category or "Raw Material Suppliers"
        existing_vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
        if existing_vendor:
            existing_vendor.status = "Approved"
            existing_vendor.category = target_category
            if user.product_service:
                existing_vendor.product = user.product_service
            if user.company:
                existing_vendor.company = user.company
            has_deliveries = db.query(Delivery.id).filter(Delivery.vendor_id == existing_vendor.id).first() is not None
            if not has_deliveries:
                existing_vendor.deliveryRate = 0.0
                perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == existing_vendor.id).first()
                if perf:
                    perf.reliability_score = 0.0
                    perf.on_time_rate = 0.0
                    perf.fulfillment_rate = 0.0
                else:
                    perf = VendorPerformance(
                        vendor_id=existing_vendor.id,
                        total_orders=0,
                        completed_orders=0,
                        on_time_deliveries=0,
                        delayed_deliveries=0,
                        partial_deliveries=0,
                        cancelled_orders=0,
                        delay_frequency=0.0,
                        on_time_rate=0.0,
                        fulfillment_rate=0.0,
                        quality_rating=0.0,
                        reliability_score=0.0,
                        average_delay_days=0.0
                    )
                    db.add(perf)
        else:
            company_name = user.company.strip() if user.company else f"{user.full_name}'s Enterprise"
            new_vendor = Vendor(
                user_id=user.id,
                name=user.full_name,
                company=company_name,
                email=user.email,
                phone=user.phone or "+1 800-555-0199",
                product=user.product_service or "General Supplies & Fabrication",
                category=target_category,
                status="Approved",
                deliveryRate=0.0,
                quality_rating=0.0,
                risk_level="Low",
                business_reg_number=user.business_reg_number,
                gst_tax_id=user.gst_tax_id,
                notes="Vendor verified and approved by Administrator."
            )
            db.add(new_vendor)
            db.flush()

            perf = VendorPerformance(
                vendor_id=new_vendor.id,
                total_orders=0,
                completed_orders=0,
                on_time_deliveries=0,
                delayed_deliveries=0,
                partial_deliveries=0,
                cancelled_orders=0,
                delay_frequency=0.0,
                on_time_rate=0.0,
                fulfillment_rate=0.0,
                quality_rating=0.0,
                reliability_score=0.0,
                average_delay_days=0.0
            )
            db.add(perf)

            contact = VendorContact(
                vendor_id=new_vendor.id,
                contact_name=user.full_name,
                title="Primary Representative",
                email=user.email,
                phone=user.phone or "+1 800-555-0199",
                is_primary=True
            )
            db.add(contact)

    # Step 5: Send notification to user that access has been approved
    send_notification(
        db=db,
        title="Account Approved",
        message=f"Welcome to Vendor Reliability & Risk Management System. Your account has been verified and approved with role '{user.role}'.",
        user_id=user.id,
        ref_id=user.id,
        ref_type="User",
        notif_type="approval"
    )

    # Audit log
    audit = AuditLog(
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_role=admin_user.role,
        action="ADMIN_USER_APPROVED",
        entity_type="User",
        entity_id=user.id,
        previous_status="PENDING",
        new_status="APPROVED",
        details=f"Admin {admin_user.email} approved user {user.email} with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"User {user.full_name} has been approved successfully with role {user.role}.",
        "user_id": user.id,
        "role": user.role,
        "approval_status": user.approval_status,
        "is_active": user.is_active
    }

@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: int,
    payload: UserRejectionRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """Admin rejects user registration with a clear reason."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.approval_status = "REJECTED"
    user.is_active = False
    user.rejection_reason = payload.rejection_reason
    user.updated_at = datetime.utcnow()

    # Send notification to user that registration was rejected
    send_notification(
        db=db,
        title="Registration Status Update",
        message=f"Your account registration was reviewed and rejected. Reason: {payload.rejection_reason}",
        user_id=user.id,
        ref_id=user.id,
        ref_type="User",
        notif_type="rejection"
    )

    # Log audit
    audit = AuditLog(
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_role=admin_user.role,
        action="ADMIN_USER_REJECTED",
        entity_type="User",
        entity_id=user.id,
        previous_status="PENDING",
        new_status="REJECTED",
        reason=payload.rejection_reason,
        details=f"Admin rejected user {user.email}. Reason: {payload.rejection_reason}"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"User {user.full_name} registration rejected.",
        "user_id": user.id,
        "approval_status": "REJECTED",
        "reason": payload.rejection_reason
    }

@router.put("/users/{user_id}/status")
def toggle_user_active_status(
    user_id: int,
    payload: UserStatusToggle,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """Admin activates or deactivates an existing user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator cannot deactivate their own account."
        )

    prev_status = "ACTIVE" if user.is_active else "INACTIVE"
    user.is_active = payload.is_active
    user.updated_at = datetime.utcnow()
    new_status = "ACTIVE" if user.is_active else "INACTIVE"

    audit = AuditLog(
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_role=admin_user.role,
        action="ADMIN_USER_STATUS_CHANGE",
        entity_type="User",
        entity_id=user.id,
        previous_status=prev_status,
        new_status=new_status,
        details=f"Admin changed active status for {user.email} to {user.is_active}"
    )
    db.add(audit)
    db.commit()

    return {"message": f"User active status updated to {user.is_active}", "user_id": user.id, "is_active": user.is_active}

@router.get("/system-statistics")
def get_system_statistics(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """Admin views system-wide operational and administrative KPI statistics."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    pending_approvals = db.query(User).filter(User.approval_status == "PENDING").count()
    
    total_vendors = db.query(Vendor).count()
    high_risk_vendors = db.query(Vendor).filter(Vendor.risk_level == "High").count()
    
    total_prs = db.query(ProcurementRequest).count()
    total_pos = db.query(PurchaseOrder).count()
    completed_deliveries = db.query(Delivery).filter(Delivery.delivery_status.in_(["Delivered", "Completed"])).count()
    pending_payments = db.query(PurchaseOrder).filter(PurchaseOrder.status == "Delivered").count()
    completed_payments = db.query(Payment).count()
    total_spend = db.query(func.sum(Payment.amount)).scalar() or 0.0

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "pending_approvals": pending_approvals
        },
        "vendors": {
            "total": total_vendors,
            "high_risk": high_risk_vendors
        },
        "lifecycle": {
            "total_requisitions": total_prs,
            "total_purchase_orders": total_pos,
            "completed_deliveries": completed_deliveries,
            "pending_payments": pending_payments,
            "completed_payments": completed_payments,
            "total_disbursed_spend": round(total_spend, 2)
        }
    }

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """Admin permanently deletes an individual user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator cannot delete their own account."
        )

    # Unlink any vendor profile
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor:
        vendor.user_id = None

    deleted_email = user.email
    deleted_name = user.full_name
    db.delete(user)
    db.commit()

    # Log audit
    audit = AuditLog(
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_role=admin_user.role,
        action="ADMIN_USER_DELETED",
        entity_type="User",
        entity_id=user_id,
        details=f"Admin {admin_user.email} deleted user {deleted_name} ({deleted_email})"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"User {deleted_name} ({deleted_email}) has been permanently deleted.",
        "deleted_user_id": user_id
    }

@router.post("/cleanup-registered-users")
def cleanup_registered_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles_strict(["Administrator"]))
):
    """
    Removes all non-administrator registered and test users from the database,
    providing a clean slate for registering new users.
    """
    from app.models.vendor import Vendor

    # Keep Administrator intact
    protected_emails = ["admin@vendor-iq.com"]
    
    users_to_remove = db.query(User).filter(~User.email.in_(protected_emails)).all()
    count = len(users_to_remove)
    removed_names = []

    for u in users_to_remove:
        # Unlink any vendor profile
        vendor = db.query(Vendor).filter(Vendor.user_id == u.id).first()
        if vendor:
            vendor.user_id = None
        removed_names.append(f"{u.full_name} ({u.email})")
        db.delete(u)

    db.commit()

    audit = AuditLog(
        user_id=admin_user.id,
        user_name=admin_user.full_name,
        user_role=admin_user.role,
        action="ADMIN_CLEANUP_USERS",
        entity_type="User",
        entity_id=admin_user.id,
        details=f"Admin cleared {count} user accounts: {', '.join(removed_names[:10])}"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Successfully cleaned up {count} registered users.",
        "removed_count": count,
        "remaining_users": ["admin@vendor-iq.com"]
    }
