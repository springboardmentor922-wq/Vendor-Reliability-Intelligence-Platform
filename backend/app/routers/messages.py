from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.communication import Message
from app.models.vendor import Vendor
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.communication import MessageCreate, MessageResponse
from app.core.dependencies import get_current_user
from app.core.audit import log_audit_event

router = APIRouter(prefix="/messages", tags=["Communication"])

@router.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        vendors = db.query(Vendor).filter(Vendor.id == current_user.vendor_id).all()
    else:
        vendors = db.query(Vendor).order_by(Vendor.company_name.asc()).all()

    convos = []
    for v in vendors:
        last_msg = db.query(Message).filter(Message.vendor_id == v.id).order_by(Message.timestamp.desc()).first()
        unread_count = db.query(Message).filter(
            Message.vendor_id == v.id,
            Message.is_read == False,
            Message.sender_id != current_user.id
        ).count()

        convos.append({
            "vendor_id": v.id,
            "vendor_name": v.company_name,
            "category": v.category.value,
            "status": v.status.value,
            "last_message": last_msg.body if last_msg else None,
            "last_message_time": last_msg.timestamp if last_msg else None,
            "unread_count": unread_count
        })
    return convos

@router.get("/vendor/{vendor_id}", response_model=List[MessageResponse])
def get_vendor_messages(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR and current_user.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    messages = db.query(Message).options(
        joinedload(Message.sender)
    ).filter(Message.vendor_id == vendor_id).order_by(Message.timestamp.asc()).all()

    for m in messages:
        if m.sender_id != current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    return messages

from app.schemas.communication import MessageCreate, MessageResponse, DirectEmailCreate, DirectEmailResponse
from app.models.notification import Notification
from app.models.enums import NotificationType

@router.post("/send-email", response_model=DirectEmailResponse, status_code=status.HTTP_201_CREATED)
def send_direct_email(
    email_in: DirectEmailCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct Formal Email Channel between Vendor and Procurement Management.
    Enables structured formal correspondence (RFQs, shipment notices, audits)
    with priority, reference tracking, attachments, and automated alert notification.
    """
    if current_user.role == UserRole.VENDOR and current_user.vendor_id != email_in.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    vendor = db.query(Vendor).filter(Vendor.id == email_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    ref_part = f" | Ref: {email_in.reference_type}" + (f" #{email_in.reference_id}" if email_in.reference_id else "")
    formatted_body = (
        f"[FORMAL EMAIL | Priority: {email_in.priority}{ref_part}]\n"
        f"Subject: {email_in.subject}\n"
        f"Recipient: {email_in.recipient_email}\n"
        f"--------------------------------------------------\n"
        f"{email_in.body}"
    )

    message = Message(
        vendor_id=email_in.vendor_id,
        sender_id=current_user.id,
        body=formatted_body,
        file_path=email_in.attachment_name,
        is_read=False,
        timestamp=datetime.utcnow()
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    if current_user.role == UserRole.VENDOR:
        proc_managers = db.query(User).filter(User.role == UserRole.PROCUREMENT_MANAGER).all()
        for pm in proc_managers:
            notif = Notification(
                user_id=pm.id,
                type=NotificationType.GENERAL,
                message=f"New formal email from '{vendor.company_name}': \"{email_in.subject}\"",
                is_read=False
            )
            db.add(notif)
    else:
        vendor_users = db.query(User).filter(User.vendor_id == vendor.id).all()
        for vu in vendor_users:
            notif = Notification(
                user_id=vu.id,
                type=NotificationType.GENERAL,
                message=f"New formal email from Procurement Team ({current_user.full_name}): \"{email_in.subject}\"",
                is_read=False
            )
            db.add(notif)

    log_audit_event(
        db, current_user.id, "SEND_FORMAL_EMAIL", "Message",
        f"Sent formal email '{email_in.subject}' to {email_in.recipient_email} regarding vendor '{vendor.company_name}'"
    )
    db.commit()

    return DirectEmailResponse(
        message_id=message.id,
        vendor_id=vendor.id,
        recipient_email=email_in.recipient_email,
        subject=email_in.subject,
        priority=email_in.priority,
        reference_type=email_in.reference_type,
        reference_id=email_in.reference_id,
        body=email_in.body,
        attachment_name=email_in.attachment_name,
        sender_name=current_user.full_name,
        sender_email=current_user.email,
        sent_at=message.timestamp,
        delivery_status="Delivered to Secure Enterprise Gateway"
    )

@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR and current_user.vendor_id != msg_in.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    vendor = db.query(Vendor).filter(Vendor.id == msg_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    message = Message(
        vendor_id=msg_in.vendor_id,
        sender_id=current_user.id,
        body=msg_in.body,
        file_path=msg_in.file_path,
        is_read=False,
        timestamp=datetime.utcnow()
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    msg_full = db.query(Message).options(joinedload(Message.sender)).filter(Message.id == message.id).first()
    return msg_full


from app.models.communication import InternalMessage
from app.schemas.communication import InternalMessageCreate, InternalMessageResponse
from app.database import Base, engine

DEFAULT_INTERNAL_CHANNELS = [
    {
        "id": "procurement-finance",
        "name": "Procurement & Finance Ops",
        "type": "channel",
        "category": "Cross-Functional",
        "subtitle": "PO line-item reviews, invoice matching, payment approvals & AP disbursements"
    },
    {
        "id": "procurement-supplychain",
        "name": "Procurement & Supply Chain Logistics",
        "type": "channel",
        "category": "Cross-Functional",
        "subtitle": "Delivery tracking, buffer inventory & warehouse dock intake logistics"
    },
    {
        "id": "governance-audit",
        "name": "Governance & Compliance Oversight",
        "type": "channel",
        "category": "Cross-Functional",
        "subtitle": "Supplier certifications, SLA breaches, audit sign-offs & risk policies"
    },
    {
        "id": "all-operations",
        "name": "General Operations (All Roles)",
        "type": "channel",
        "category": "Broadcast",
        "subtitle": "Cross-role announcements, milestone alerts & operational notices"
    }
]

DEFAULT_SEED_MESSAGES = {
    "procurement-finance": [
        ("procurement@vendoriq.com", "Hi Clara, Purchase Order PO-2026-F6124E with SwiftLine Logistics has passed receiving inspection at Dock 4. Can Finance review and approve Tax Invoice INV-2026-8801?"),
        ("finance@vendoriq.com", "Hello Priya, verifying the 3-way match now. PO quantity and unit price match the warehouse delivery slip perfectly. Invoice approved for Net 30 remittance."),
        ("procurement@vendoriq.com", "Excellent, thank you Clara! I've updated the procurement status to delivered.")
    ],
    "procurement-supplychain": [
        ("supplychain@vendoriq.com", "Priya, heads up regarding Apex Raw Materials shipment PO-2026-APX01. Carrier reports a 2-day transit delay due to western freight corridor maintenance."),
        ("procurement@vendoriq.com", "Thanks for the early alert Marcus! We have 14 days of safety stock in the central warehouse, so production won't be disrupted. Please monitor tracking status."),
        ("supplychain@vendoriq.com", "Will do. Telemetry feed has been updated and automated carrier pings are active.")
    ],
    "governance-audit": [
        ("auditor@vendoriq.com", "Arthur & Priya, Nova Precision Machinery's CE Safety Certification is due to expire in 25 days. Please ensure they upload the renewed certification before expiration."),
        ("admin@vendoriq.com", "Noted Benjamin. I have placed an alert in the audit log and scheduled compliance review."),
        ("procurement@vendoriq.com", "Understood Arthur and Benjamin. I have dispatched a formal notice to their vendor representative.")
    ],
    "all-operations": [
        ("admin@vendoriq.com", "Team, welcome to the internal SCM & Procurement Operations Workspace. Please use these dedicated channels to coordinate order milestones, approvals, and compliance."),
        ("procurement@vendoriq.com", "Procurement team active. Requisition queue is cleared and all high-priority POs are routed for review."),
        ("finance@vendoriq.com", "Accounts Payable operational. Invoices received by 4 PM will be cleared in today's matching cycle."),
        ("supplychain@vendoriq.com", "Warehouse docks 1 through 6 are fully operational. Safety stock metrics are updated on the dashboard.")
    ]
}

def ensure_internal_tables_and_seeds(db: Session):
    Base.metadata.create_all(bind=engine)
    count = db.query(InternalMessage).count()
    if count == 0:
        users_by_email = {u.email: u for u in db.query(User).all()}
        for channel_id, msg_list in DEFAULT_SEED_MESSAGES.items():
            for idx, (sender_email, text) in enumerate(msg_list):
                sender = users_by_email.get(sender_email)
                if sender:
                    im = InternalMessage(
                        channel=channel_id,
                        sender_id=sender.id,
                        body=text,
                        is_read=True,
                        timestamp=datetime.utcnow()
                    )
                    db.add(im)
        db.commit()

@router.get("/internal/channels")
def get_internal_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_internal_tables_and_seeds(db)

    channel_list = []
    for c in DEFAULT_INTERNAL_CHANNELS:
        last_msg = db.query(InternalMessage).filter(InternalMessage.channel == c["id"]).order_by(InternalMessage.timestamp.desc()).first()
        unread = db.query(InternalMessage).filter(
            InternalMessage.channel == c["id"],
            InternalMessage.is_read == False,
            InternalMessage.sender_id != current_user.id
        ).count()
        channel_list.append({
            **c,
            "last_message": last_msg.body if last_msg else None,
            "last_message_time": last_msg.timestamp if last_msg else None,
            "unread_count": unread
        })

    internal_peers = db.query(User).filter(
        User.role != UserRole.VENDOR,
        User.id != current_user.id
    ).order_by(User.full_name.asc()).all()

    direct_list = []
    for peer in internal_peers:
        dm_channel = f"dm-{min(current_user.id, peer.id)}-{max(current_user.id, peer.id)}"
        last_msg = db.query(InternalMessage).filter(InternalMessage.channel == dm_channel).order_by(InternalMessage.timestamp.desc()).first()
        unread = db.query(InternalMessage).filter(
            InternalMessage.channel == dm_channel,
            InternalMessage.is_read == False,
            InternalMessage.sender_id != current_user.id
        ).count()
        direct_list.append({
            "id": dm_channel,
            "name": peer.full_name,
            "role": peer.role.value if hasattr(peer.role, 'value') else str(peer.role),
            "email": peer.email,
            "type": "direct",
            "category": "Direct Team Chat",
            "subtitle": f"Direct collaboration with {peer.role}",
            "last_message": last_msg.body if last_msg else None,
            "last_message_time": last_msg.timestamp if last_msg else None,
            "unread_count": unread
        })

    return {
        "channels": channel_list,
        "direct_messages": direct_list
    }

@router.get("/internal/{channel_id}", response_model=List[InternalMessageResponse])
def get_internal_channel_messages(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_internal_tables_and_seeds(db)

    messages = db.query(InternalMessage).options(
        joinedload(InternalMessage.sender)
    ).filter(InternalMessage.channel == channel_id).order_by(InternalMessage.timestamp.asc()).all()

    for m in messages:
        if m.sender_id != current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    return messages

@router.post("/internal", response_model=InternalMessageResponse, status_code=status.HTTP_201_CREATED)
def post_internal_message(
    msg_in: InternalMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ensure_internal_tables_and_seeds(db)

    message = InternalMessage(
        channel=msg_in.channel,
        sender_id=current_user.id,
        body=msg_in.body,
        file_path=msg_in.file_path,
        is_read=False,
        timestamp=datetime.utcnow()
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    msg_full = db.query(InternalMessage).options(joinedload(InternalMessage.sender)).filter(InternalMessage.id == message.id).first()
    return msg_full


