"""Vendor communications workspace with thread-friendly records."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from deps import (
    ensure_vendor_scope,
    get_current_user,
    get_db,
    log_activity,
    normalize_role,
)

router = APIRouter(prefix="/api/communications", tags=["communications"])


class MessageCreate(BaseModel):
    vendor_id: int
    message: str = Field(min_length=1, max_length=5000)
    subject: str = Field(default="General Inquiry", max_length=200)
    thread_id: str | None = None
    attachment_path: str | None = None


def _serialize(msg):
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": msg.user.name if msg.user else None,
        "sender_role": normalize_role(msg.user.role) if msg.user else None,
        "sender_role": normalize_role(msg.user.role) if msg.user else None,
        "vendor_id": msg.vendor_id,
        "vendor_name": msg.vendor.company_name if msg.vendor else None,
        "message": msg.message,
        "subject": msg.subject,
        "thread_id": msg.thread_id,
        "attachment_path": msg.attachment_path,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("")
def list_communications(
    vendor_id: int | None = None,
    thread_id: str | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Communication).order_by(
        models.Communication.created_at.asc()
    )
    role = normalize_role(current_user.role)
    if role == "vendor":
        vendor_id = current_user.vendor_id
    if vendor_id:
        query = query.filter(models.Communication.vendor_id == vendor_id)
    if thread_id:
        query = query.filter(models.Communication.thread_id == thread_id)
    return [_serialize(m) for m in query.limit(500).all()]


@router.post("")
def send_communication(
    payload: MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_vendor_scope(current_user, payload.vendor_id)
    if (
        not db.query(models.Vendor)
        .filter(models.Vendor.id == payload.vendor_id)
        .first()
    ):
        raise HTTPException(status_code=404, detail="Vendor not found")
    message = models.Communication(
        sender_id=current_user.id,
        vendor_id=payload.vendor_id,
        message=payload.message.strip(),
        subject=payload.subject.strip(),
        thread_id=payload.thread_id or f"thread-{uuid4().hex[:12]}",
        attachment_path=payload.attachment_path,
    )
    db.add(message)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "SEND_COMMUNICATION",
        "Communication",
        message.id,
        f"Sent message in {message.thread_id}",
    )
    db.commit()
    db.refresh(message)
    return _serialize(message)


@router.get("/threads")
def get_threads(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    role = normalize_role(current_user.role)
    query = db.query(models.Communication).order_by(
        models.Communication.created_at.desc()
    )
    if role == "vendor":
        query = query.filter(models.Communication.vendor_id == current_user.vendor_id)
    messages = query.all()
    grouped = {}
    for message in messages:
        key = message.thread_id or f"thread-{message.vendor_id}"
        if key not in grouped:
            grouped[key] = {
                "thread_id": key,
                "vendor_id": message.vendor_id,
                "vendor_name": message.vendor.company_name if message.vendor else None,
                "subject": message.subject,
                "last_message": message.message,
                "updated_at": message.created_at.isoformat()
                if message.created_at
                else None,
                "message_count": 0,
            }
        grouped[key]["message_count"] += 1
    return sorted(grouped.values(), key=lambda x: x["updated_at"] or "", reverse=True)
