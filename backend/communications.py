"""Milestone-2: Communications and Vendor Messaging module.

Provides messaging between procurement teams and vendors, communication history,
discussion threads, and response tracking.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import get_current_user, get_db, require_role, log_activity
from notifications import create_notification, notify_roles

router = APIRouter(prefix="/api/communications", tags=["communications"])


class MessageCreate(BaseModel):
    vendor_id: int
    subject: str = "General Inquiry"
    message: str | None = None
    message_body: str | None = None
    message_type: str | None = "Inquiry"
    attachment_path: str | None = None



def _serialize_msg(msg: models.Communication, user: models.User | None = None, vendor: models.Vendor | None = None) -> dict:
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": user.name if user else (msg.user.name if msg.user else f"User #{msg.sender_id}"),
        "sender_role": user.role if user else (msg.user.role if msg.user else "user"),
        "vendor_id": msg.vendor_id,
        "vendor_name": vendor.company_name if vendor else (msg.vendor.company_name if msg.vendor else f"Vendor #{msg.vendor_id}"),
        "subject": msg.subject,
        "message": msg.message,
        "attachment_path": msg.attachment_path,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("")
def list_communications(
    vendor_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List communication messages. If the user is a Vendor, auto-scope to their company."""
    query = db.query(models.Communication)

    # Scoping for vendor-role users: only view their own vendor messages
    if "vendor" in current_user.role.lower():
        if current_user.vendor_id:
            query = query.filter(models.Communication.vendor_id == current_user.vendor_id)
        else:
            v = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if v:
                query = query.filter(models.Communication.vendor_id == v.id)
            else:
                return []
    elif vendor_id is not None:
        query = query.filter(models.Communication.vendor_id == vendor_id)

    messages = query.order_by(models.Communication.created_at.asc()).limit(limit).all()
    return [_serialize_msg(m) for m in messages]


@router.post("")
def send_communication(
    payload: MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a new message / inquiry to a vendor or from a vendor."""
    # If vendor user, enforce their own vendor_id
    vendor_id = payload.vendor_id
    if "vendor" in current_user.role.lower():
        if current_user.vendor_id:
            vendor_id = current_user.vendor_id
        else:
            v = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if v:
                vendor_id = v.id

    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    body_text = payload.message_body or payload.message or "Inquiry message"
    msg = models.Communication(
        sender_id=current_user.id,
        vendor_id=vendor_id,
        subject=payload.subject or "Procurement Discussion",
        message=body_text,
        attachment_path=payload.attachment_path,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Notify counterpart
    if "vendor" in current_user.role.lower():
        notify_roles(
            db, ["admin", "procurement", "manager"],
            f"Vendor Message: {vendor.company_name}",
            f"{current_user.name} ({vendor.company_name}) sent: {payload.subject}",
            "procurement",
        )
    else:
        # Notify vendor account if exists
        vendor_users = db.query(models.User).filter(models.User.vendor_id == vendor_id).all()
        for vu in vendor_users:
            create_notification(
                db, vu.id,
                f"Message from Procurement ({current_user.name})",
                f"{payload.subject}: {body_text[:100]}",

                "procurement",
            )

    log_activity(
        db, current_user.id, "SEND_MESSAGE", "Communication", msg.id,
        f"Sent message to Vendor #{vendor_id} ({vendor.company_name}) - Subject: {payload.subject}"
    )
    db.commit()
    return _serialize_msg(msg, current_user, vendor)


@router.get("/threads")
def get_threads(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Summary list of discussion threads grouped by vendor."""
    vendors = db.query(models.Vendor).all()
    threads = []

    for v in vendors:
        # If user is vendor, filter only their company
        if "vendor" in current_user.role.lower():
            if current_user.vendor_id and current_user.vendor_id != v.id:
                continue
            if not current_user.vendor_id and current_user.email != v.email:
                continue

        last_msg = db.query(models.Communication).filter(
            models.Communication.vendor_id == v.id
        ).order_by(models.Communication.created_at.desc()).first()

        total_msgs = db.query(models.Communication).filter(
            models.Communication.vendor_id == v.id
        ).count()

        threads.append({
            "vendor_id": v.id,
            "vendor_name": v.company_name,
            "category": v.category,
            "total_messages": total_msgs,
            "last_message": last_msg.message if last_msg else None,
            "last_subject": last_msg.subject if last_msg else None,
            "last_sender": (last_msg.user.name if last_msg and last_msg.user else None),
            "last_activity": last_msg.created_at.isoformat() if last_msg else v.created_at.isoformat(),
        })

    # Sort threads with most recent activity first
    threads.sort(key=lambda x: x["last_activity"] or "", reverse=True)
    return threads
