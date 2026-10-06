"""
VendorIQ Notification Service

Channels:
- In-app notifications
- Email notifications
- SMS notifications

Email:
- Uses SMTP when SMTP credentials are configured.
- Otherwise records the notification as simulated.

SMS:
- Uses Twilio when Twilio credentials are configured.
- Otherwise records the notification as simulated.

The notification system is designed so that notification failures
do not break the main business operation.
"""

import logging
import os
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.core.utils import notify_user
from app.models.communication import Notification
from app.models.contract import (
    Certification,
    CertificationStatus,
    Contract,
    ContractStatus,
)
from app.models.notification_log import EmailLog
from app.models.purchase_order import POStatus, PurchaseOrder
from app.models.user import User, UserRole
from app.models.vendor import Vendor


logger = logging.getLogger(__name__)


# ============================================================
# EMAIL CONFIGURATION
# ============================================================

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"


# ============================================================
# SMS CONFIGURATION
# ============================================================

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")


# ============================================================
# EMAIL
# ============================================================

def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    event_type: str,
) -> EmailLog:
    """
    Send an email through SMTP when configured.

    If SMTP is not configured, the email is recorded as
    simulated instead of failing the application.
    """

    status = "simulated"

    try:
        if (
            SMTP_HOST
            and SMTP_USER
            and SMTP_PASSWORD
            and SMTP_FROM
            and to_email
        ):
            message = EmailMessage()
            message["From"] = SMTP_FROM
            message["To"] = to_email
            message["Subject"] = subject
            message.set_content(body)

            with smtplib.SMTP(
                SMTP_HOST,
                SMTP_PORT,
                timeout=15,
            ) as smtp:

                if SMTP_USE_TLS:
                    smtp.starttls()

                smtp.login(
                    SMTP_USER,
                    SMTP_PASSWORD,
                )

                smtp.send_message(message)

            status = "sent"

            logger.info(
                "EMAIL SENT | to=%s | subject=%s",
                to_email,
                subject,
            )

        else:
            logger.info(
                "EMAIL SIMULATED | to=%s | subject=%s",
                to_email,
                subject,
            )

    except Exception as exc:
        logger.exception(
            "Email delivery failed: %s",
            exc,
        )
        status = "failed"

    log = EmailLog(
        to_email=to_email,
        subject=subject,
        body=body,
        event_type=event_type,
        status=status,
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return log


# ============================================================
# SMS
# ============================================================

def send_sms(
    phone_number: str | None,
    message: str,
    event_type: str,
) -> str:
    """
    Send SMS through Twilio when configured.

    If Twilio is not configured, the SMS is recorded as
    simulated in the application log.
    """

    if not phone_number:
        logger.info(
            "SMS SKIPPED | no phone number | event=%s",
            event_type,
        )
        return "skipped"

    try:

        if (
            TWILIO_ACCOUNT_SID
            and TWILIO_AUTH_TOKEN
            and TWILIO_FROM_NUMBER
        ):

            from twilio.rest import Client

            client = Client(
                TWILIO_ACCOUNT_SID,
                TWILIO_AUTH_TOKEN,
            )

            client.messages.create(
                body=message,
                from_=TWILIO_FROM_NUMBER,
                to=phone_number,
            )

            logger.info(
                "SMS SENT | to=%s | event=%s",
                phone_number,
                event_type,
            )

            return "sent"

        logger.info(
            "SMS SIMULATED | to=%s | event=%s",
            phone_number,
            event_type,
        )

        return "simulated"

    except Exception as exc:
        logger.exception(
            "SMS delivery failed: %s",
            exc,
        )

        return "failed"


# ============================================================
# MAIN NOTIFICATION FUNCTION
# ============================================================

def notify_and_email(
    db: Session,
    user: User,
    event_type: str,
    title: str,
    message: str,
    related_type=None,
    related_id=None,
):
    """
    Send an in-app notification, email and SMS.

    Duplicate protection:
    The same unread notification will not be created again
    for the same user + event + related entity.
    """

    # --------------------------------------------------------
    # DUPLICATE CHECK
    # --------------------------------------------------------

    existing = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.type == event_type,
            Notification.related_entity_type == related_type,
            Notification.related_entity_id == str(related_id),
            Notification.is_read.is_(False),
        )
        .first()
    )

    if existing:
        logger.info(
            "DUPLICATE NOTIFICATION SKIPPED | user=%s | event=%s | entity=%s:%s",
            user.id,
            event_type,
            related_type,
            related_id,
        )

        return {
            "in_app": "already_exists",
            "email": "skipped",
            "sms": "skipped",
            "notification_id": existing.id,
        }

    # --------------------------------------------------------
    # 1. IN-APP NOTIFICATION
    # --------------------------------------------------------

    try:
        notify_user(
            db,
            user.id,
            event_type,
            title,
            message,
            related_type,
            related_id,
        )

        in_app_status = "sent"

    except Exception as exc:
        logger.exception(
            "In-app notification failed: %s",
            exc,
        )

        db.rollback()

        in_app_status = "failed"

    # --------------------------------------------------------
    # 2. EMAIL
    # --------------------------------------------------------

    email_status = "skipped"

    if user.email:
        try:
            email_log = send_email(
                db=db,
                to_email=user.email,
                subject=title,
                body=message,
                event_type=event_type,
            )

            email_status = email_log.status

        except Exception as exc:
            logger.exception(
                "Email notification failed: %s",
                exc,
            )

            email_status = "failed"

    # --------------------------------------------------------
    # 3. SMS
    # --------------------------------------------------------

    try:
        sms_status = send_sms(
            phone_number=user.phone,
            message=f"{title}: {message}",
            event_type=event_type,
        )

    except Exception as exc:
        logger.exception(
            "SMS notification failed: %s",
            exc,
        )

        sms_status = "failed"

    return {
        "in_app": in_app_status,
        "email": email_status,
        "sms": sms_status,
    }


# ============================================================
# EVENT NOTIFICATION
# ============================================================

def notify_event(
    db: Session,
    user: User,
    event_type: str,
    title: str,
    message: str,
    related_type=None,
    related_id=None,
):
    """
    Send an event notification through all configured channels.
    """

    if not user:
        logger.warning(
            "Notification skipped because user does not exist."
        )
        return None

    return notify_and_email(
        db=db,
        user=user,
        event_type=event_type,
        title=title,
        message=message,
        related_type=related_type,
        related_id=related_id,
    )


# ============================================================
# USER ID WRAPPER
# ============================================================

def notify_user_event(
    db: Session,
    user_id,
    event_type: str,
    title: str,
    message: str,
    related_type=None,
    related_id=None,
):
    """
    Send a notification when only the user ID is available.
    """

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        logger.warning(
            "Notification recipient not found: %s",
            user_id,
        )
        return None

    return notify_event(
        db=db,
        user=user,
        event_type=event_type,
        title=title,
        message=message,
        related_type=related_type,
        related_id=related_id,
    )


# ============================================================
# CONTRACT + COMPLIANCE CHECK
# ============================================================

def run_expiry_and_compliance_checks(
    db: Session,
    days: int = 30,
) -> dict:
    """
    Check contracts and certifications that are expiring
    within the specified number of days.

    Notifications are sent to:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    """

    now = datetime.utcnow()
    cutoff = now + timedelta(days=days)

    # --------------------------------------------------------
    # RECIPIENTS
    # --------------------------------------------------------

    approvers = (
        db.query(User)
        .filter(
            User.role.in_(
                [
                    UserRole.ADMIN,
                    UserRole.PROCUREMENT_MANAGER,
                    UserRole.SUPPLY_CHAIN_MANAGER,
                ]
            )
        )
        .all()
    )

    # --------------------------------------------------------
    # CONTRACTS
    # --------------------------------------------------------

    expiring_contracts = (
        db.query(Contract)
        .filter(
            Contract.end_date >= now,
            Contract.end_date <= cutoff,
            Contract.status != ContractStatus.TERMINATED,
        )
        .all()
    )

    # --------------------------------------------------------
    # CERTIFICATIONS
    # --------------------------------------------------------

    expiring_certs = (
        db.query(Certification)
        .filter(
            Certification.expiry_date.isnot(None),
            Certification.expiry_date >= now,
            Certification.expiry_date <= cutoff,
            Certification.status != CertificationStatus.EXPIRED,
        )
        .all()
    )

    notified = 0

    # --------------------------------------------------------
    # CONTRACT EXPIRY
    # --------------------------------------------------------

    for contract in expiring_contracts:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == contract.vendor_id)
            .first()
        )

        title = (
            f"Contract expiring soon: "
            f"{contract.contract_number}"
        )

        message = (
            f"{vendor.company_name if vendor else 'Vendor'}'s "
            f"contract '{contract.title}' expires on "
            f"{contract.end_date.date()}."
        )

        for approver in approvers:

            result = notify_event(
                db,
                approver,
                "contract_expiry",
                title,
                message,
                "contract",
                contract.id,
            )

            if result and result.get("in_app") == "sent":
                notified += 1

    # --------------------------------------------------------
    # COMPLIANCE / CERTIFICATION
    # --------------------------------------------------------

    for cert in expiring_certs:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == cert.vendor_id)
            .first()
        )

        title = (
            f"Certification expiring soon: "
            f"{cert.name}"
        )

        message = (
            f"{vendor.company_name if vendor else 'Vendor'}'s "
            f"certification '{cert.name}' expires on "
            f"{cert.expiry_date.date()}."
        )

        for approver in approvers:

            result = notify_event(
                db,
                approver,
                "compliance_alert",
                title,
                message,
                "certification",
                cert.id,
            )

            if result and result.get("in_app") == "sent":
                notified += 1

    return {
        "expiring_contracts": len(expiring_contracts),
        "expiring_certifications": len(expiring_certs),
        "notifications_sent": notified,
    }


# ============================================================
# DELIVERY DELAY CHECK
# ============================================================

def run_delivery_delay_checks(
    db: Session,
) -> dict:
    """
    Notify vendors when an expected delivery date has passed.
    """

    now = datetime.utcnow()

    delayed_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status.in_(
                [
                    POStatus.PENDING,
                    POStatus.APPROVED,
                    POStatus.ORDERED,
                ]
            ),
            PurchaseOrder.expected_delivery_date.isnot(None),
            PurchaseOrder.expected_delivery_date < now,
        )
        .all()
    )

    notified = 0

    for po in delayed_orders:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == po.vendor_id)
            .first()
        )

        if not vendor or not vendor.user_id:
            continue

        title = (
            f"Delivery delay: "
            f"{po.po_number}"
        )

        message = (
            f"Purchase order {po.po_number} was expected by "
            f"{po.expected_delivery_date} and has not been delivered."
        )

        result = notify_user_event(
            db=db,
            user_id=vendor.user_id,
            event_type="delivery_delay",
            title=title,
            message=message,
            related_type="purchase_order",
            related_id=po.id,
        )

        if result and result.get("in_app") == "sent":
            notified += 1

    return {
        "delayed_orders": len(delayed_orders),
        "notifications_sent": notified,
    }