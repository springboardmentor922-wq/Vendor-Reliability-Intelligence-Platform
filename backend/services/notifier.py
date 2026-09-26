"""Notification dispatch and the recurring alert sweep.

    python -m services.notifier            # run the sweep once

--------------------------------------------------------------------------
Channels
--------------------------------------------------------------------------
Every alert is written to the in-app inbox.  Email (SMTP) and SMS (Twilio)
are additional channels, enabled per environment.  With no credentials
configured the payload is logged and the row still records that the channel
was selected, so the flow is demonstrable end to end without standing up a
mail server - and ``email_sent`` stays false, so nothing claims a delivery
that did not happen.

--------------------------------------------------------------------------
The sweep
--------------------------------------------------------------------------
``run_alert_sweep`` derives alerts from the current state of the database:

  delivery delay      open purchase orders past their committed date
  contract expiry     contracts inside their renewal notice window
  compliance          failed checks, expired or expiring certifications
  vendor approval     vendors sitting in the approval queue
  procurement         requests and purchase orders awaiting a decision
  predictive risk     open orders the model flags as likely to run late

Each alert carries an ``event_key`` naming the thing that caused it, and a
unique index on ``(user_id, event_key)`` means re-running the sweep updates
rather than duplicates.  Nothing here is hard-coded: remove the overdue
order and the next sweep stops raising the alert.
"""

from __future__ import annotations

import smtplib
from datetime import date, timedelta
from email.message import EmailMessage
from typing import Iterable, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from config import settings
from models import (
    ComplianceCheck,
    Contract,
    ContractStatus,
    Notification,
    NotificationType,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
    User,
    UserRole,
    Vendor,
    VendorCertification,
    VendorStatus
)


class Channel:
    IN_APP = "In-App"
    EMAIL = "Email"
    SMS = "SMS"


# --------------------------------------------------------------------------
# Outbound delivery
# --------------------------------------------------------------------------

def send_email(to_address: str, subject: str, body: str) -> bool:
    """Send one email. Returns whether it actually went out."""

    if not settings.EMAIL_ENABLED or not settings.SMTP_HOST:
        print(f"[email:disabled] to={to_address} subject={subject!r}")
        return False

    if not to_address:
        return False

    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()

            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.send_message(message)

        return True
    except Exception as exc:  # pragma: no cover - depends on the mail host
        print(f"[email:failed] to={to_address}: {exc}")
        return False


def send_sms(to_number: str, body: str) -> bool:
    """Send one SMS through Twilio. Returns whether it actually went out."""

    if not settings.SMS_ENABLED or not settings.TWILIO_ACCOUNT_SID:
        print(f"[sms:disabled] to={to_number} body={body[:60]!r}")
        return False

    if not to_number:
        return False

    try:
        from twilio.rest import Client

        client = Client(
            settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN
        )

        client.messages.create(
            body=body[:1600],
            from_=settings.TWILIO_FROM_NUMBER,
            to=to_number,
        )

        return True
    except ImportError:
        print("[sms:failed] the twilio package is not installed")
        return False
    except Exception as exc:  # pragma: no cover - depends on the provider
        print(f"[sms:failed] to={to_number}: {exc}")
        return False


def dispatch(
    db: Session,
    user: User,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    priority: str = "Medium",
    event_key: Optional[str] = None,
    email: bool = False,
    sms: bool = False,
) -> Notification:
    """Raise one alert, optionally over email and SMS as well.

    When ``event_key`` is supplied and an alert already exists for that
    event, the existing row is refreshed instead of a duplicate being
    created - which is what lets the sweep run on a schedule.
    """

    existing = None

    if event_key:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.event_key == event_key,
            )
            .first()
        )

    # High-priority alerts go out over email as well, unless told otherwise.
    email = email or priority == "High"

    channel = Channel.IN_APP

    if email and sms:
        channel = f"{Channel.IN_APP}, {Channel.EMAIL}, {Channel.SMS}"
    elif email:
        channel = f"{Channel.IN_APP}, {Channel.EMAIL}"
    elif sms:
        channel = f"{Channel.IN_APP}, {Channel.SMS}"

    if existing:
        existing.title = title
        existing.message = message
        existing.link = link
        existing.priority = priority
        existing.channel = channel

        return existing

    notification = Notification(
        user_id=user.id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        priority=priority,
        channel=channel,
        event_key=event_key,
    )

    if email:
        notification.email_sent = send_email(user.email, title, message)

    if sms:
        notification.sms_sent = send_sms(user.phone, f"{title}: {message}")

    db.add(notification)

    return notification


def dispatch_to_roles(
    db: Session,
    roles: Iterable[str],
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    priority: str = "Medium",
    event_key: Optional[str] = None,
    email: bool = False,
    sms: bool = False,
) -> int:
    """Raise the same alert for every active user holding one of ``roles``."""

    users = (
        db.query(User)
        .filter(User.role.in_(list(roles)), User.is_active.is_(True))
        .all()
    )

    for user in users:
        dispatch(
            db, user, notification_type, title, message, link,
            priority, event_key, email, sms,
        )

    return len(users)


# --------------------------------------------------------------------------
# The sweep
# --------------------------------------------------------------------------

PROCUREMENT_ROLES = [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER]
SUPPLY_ROLES = PROCUREMENT_ROLES + [UserRole.SUPPLY_CHAIN_MANAGER]
AUDIT_ROLES = PROCUREMENT_ROLES + [UserRole.AUDITOR]


def _vendor_users(db: Session, vendor_id: int) -> list[User]:
    return (
        db.query(User)
        .filter(
            User.role == UserRole.VENDOR,
            User.vendor_id == vendor_id,
            User.is_active.is_(True),
        )
        .all()
    )


def sweep_delivery_delays(db: Session) -> int:
    """Alert on open purchase orders that are past their committed date."""

    today = date.today()
    threshold = today - timedelta(days=settings.DELIVERY_DELAY_ALERT_DAYS)

    overdue = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status.in_([
                PurchaseOrderStatus.APPROVED,
                PurchaseOrderStatus.ORDERED,
            ]),
            PurchaseOrder.expected_delivery.isnot(None),
            PurchaseOrder.expected_delivery < threshold,
        )
        .all()
    )

    raised = 0

    for order in overdue:
        days_late = (today - order.expected_delivery).days
        vendor = order.vendor

        title = f"Delivery delayed: {order.po_number}"
        message = (
            f"{order.po_number} to {vendor.vendor_name if vendor else 'vendor'} "
            f"is {days_late} day(s) past its committed delivery date of "
            f"{order.expected_delivery}."
        )

        event_key = f"delivery-delay:{order.id}"
        priority = "High" if days_late >= 7 else "Medium"

        raised += dispatch_to_roles(
            db, SUPPLY_ROLES, NotificationType.DELIVERY,
            title, message, f"/purchase-orders/{order.id}",
            priority, event_key,
            # A badly overdue order is worth an SMS to the buyer.
            sms=days_late >= 14,
        )

        # The supplier is told too - that is the point of the vendor portal.
        for user in _vendor_users(db, order.vendor_id):
            dispatch(
                db, user, NotificationType.DELIVERY,
                title,
                f"{order.po_number} is {days_late} day(s) overdue. Please "
                f"confirm a revised delivery date.",
                f"/purchase-orders/{order.id}", priority, event_key,
            )
            raised += 1

    db.commit()

    return raised


def sweep_contract_expiry(db: Session) -> int:
    """Alert on contracts inside their renewal notice window, and expired ones."""

    today = date.today()
    horizon = today + timedelta(days=settings.CONTRACT_EXPIRY_ALERT_DAYS)

    contracts = (
        db.query(Contract)
        .filter(
            Contract.status.notin_([
                ContractStatus.TERMINATED, ContractStatus.RENEWED,
            ]),
            Contract.expiry_date <= horizon,
        )
        .all()
    )

    raised = 0

    for contract in contracts:
        days_left = (contract.expiry_date - today).days
        vendor = contract.vendor

        if days_left < 0:
            title = f"Contract expired: {contract.contract_number}"
            message = (
                f"{contract.contract_number} with "
                f"{vendor.vendor_name if vendor else 'the vendor'} expired "
                f"{abs(days_left)} day(s) ago on {contract.expiry_date}."
            )
            priority = "High"
        else:
            title = f"Contract expiring: {contract.contract_number}"
            message = (
                f"{contract.contract_number} with "
                f"{vendor.vendor_name if vendor else 'the vendor'} expires in "
                f"{days_left} day(s) on {contract.expiry_date}."
            )
            priority = "High" if days_left <= 7 else "Medium"

        raised += dispatch_to_roles(
            db, PROCUREMENT_ROLES, NotificationType.CONTRACT_EXPIRY,
            title, message, f"/contracts/{contract.id}",
            priority, f"contract-expiry:{contract.id}",
        )

        # Keep the contract's own status honest while we are here.
        if days_left < 0 and contract.status != ContractStatus.EXPIRED:
            contract.status = ContractStatus.EXPIRED
        elif (
            0 <= days_left <= contract.renewal_notice_days
            and contract.status == ContractStatus.ACTIVE
        ):
            contract.status = ContractStatus.EXPIRING

    db.commit()

    return raised


def sweep_compliance(db: Session) -> int:
    """Alert on failed checks and lapsed or lapsing certifications."""

    today = date.today()
    raised = 0

    recent_failures = (
        db.query(ComplianceCheck)
        .filter(
            ComplianceCheck.result == "Non-Compliant",
            ComplianceCheck.check_date >= today - timedelta(days=180),
        )
        .all()
    )

    for check in recent_failures:
        vendor = check.vendor

        raised += dispatch_to_roles(
            db, AUDIT_ROLES, NotificationType.COMPLIANCE,
            f"Compliance failure: {vendor.vendor_name if vendor else 'vendor'}",
            f"A {check.check_type} check on {check.check_date} was recorded "
            f"as Non-Compliant. {check.remarks or ''}".strip(),
            f"/vendors/{check.vendor_id}",
            "High", f"compliance-fail:{check.id}",
        )

    lapsing = (
        db.query(VendorCertification)
        .filter(
            VendorCertification.expiry_date
            <= today + timedelta(days=settings.CERTIFICATION_ALERT_DAYS)
        )
        .all()
    )

    for certificate in lapsing:
        days_left = (certificate.expiry_date - today).days
        expired = days_left < 0

        raised += dispatch_to_roles(
            db, AUDIT_ROLES, NotificationType.COMPLIANCE,
            (
                f"Certification {'expired' if expired else 'expiring'}: "
                f"{certificate.certification_name}"
            ),
            (
                f"{certificate.certification_name} "
                f"({certificate.certificate_number}) "
                + (
                    f"expired {abs(days_left)} day(s) ago."
                    if expired
                    else f"expires in {days_left} day(s)."
                )
            ),
            f"/vendors/{certificate.vendor_id}",
            "High" if expired else "Medium",
            f"certification:{certificate.id}",
        )

        certificate.status = (
            "Expired" if expired else "Expiring" if days_left <= 60 else "Valid"
        )

    db.commit()

    return raised


def sweep_vendor_approvals(db: Session) -> int:
    """Alert on vendors waiting in the approval queue."""

    pending = (
        db.query(Vendor).filter(Vendor.status == VendorStatus.PENDING).all()
    )

    raised = 0

    for vendor in pending:
        raised += dispatch_to_roles(
            db, PROCUREMENT_ROLES, NotificationType.VENDOR_APPROVAL,
            "Vendor awaiting approval",
            f"{vendor.vendor_name} ({vendor.vendor_code}) is registered and "
            f"waiting for an approval decision.",
            f"/vendors/{vendor.id}",
            "Medium", f"vendor-approval:{vendor.id}",
        )

    db.commit()

    return raised


def sweep_procurement(db: Session) -> int:
    """Alert on procurement requests and purchase orders awaiting a decision."""

    raised = 0

    pending_requests = (
        db.query(func.count(ProcurementRequest.id))
        .filter(ProcurementRequest.status == ProcurementStatus.PENDING)
        .scalar()
    ) or 0

    if pending_requests:
        raised += dispatch_to_roles(
            db, PROCUREMENT_ROLES, NotificationType.PROCUREMENT,
            "Procurement requests awaiting approval",
            f"{pending_requests} procurement request(s) are pending a "
            f"decision.",
            "/procurement", "Medium", "procurement-pending-requests",
        )

    pending_orders = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.status == PurchaseOrderStatus.PENDING)
        .scalar()
    ) or 0

    if pending_orders:
        raised += dispatch_to_roles(
            db, PROCUREMENT_ROLES, NotificationType.PROCUREMENT,
            "Purchase orders awaiting approval",
            f"{pending_orders} purchase order(s) are pending approval.",
            "/purchase-orders", "Medium", "procurement-pending-orders",
        )

    db.commit()

    return raised


def sweep_predicted_delays(db: Session) -> int:
    """Alert on open orders the model expects to miss their date.

    This is the forward-looking half of the notification module: the order
    is not late yet, but the model says it probably will be, which is early
    enough for the buyer to do something about it.
    """

    from ml import predictor

    open_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status.in_([
                PurchaseOrderStatus.APPROVED,
                PurchaseOrderStatus.ORDERED,
            ]),
            PurchaseOrder.expected_delivery.isnot(None),
            PurchaseOrder.expected_delivery >= date.today(),
        )
        .all()
    )

    if not open_orders:
        return 0

    rows = []

    for order in open_orders:
        vendor = order.vendor

        rows.append(
            predictor.build_feature_row(
                shipping_mode=order.shipping_mode,
                market=order.market,
                order_region=order.order_region,
                procurement_category=vendor.category if vendor else None,
                quantity=float(sum((i.quantity or 0) for i in order.items) or 1),
                order_value=float(order.total_amount or 0),
                unit_price=float(order.items[0].unit_price if order.items else 0),
                order_month=order.order_date.month if order.order_date else 1,
                order_quarter=(
                    (order.order_date.month - 1) // 3 + 1
                    if order.order_date else 1
                ),
                order_weekday=(
                    order.order_date.weekday() if order.order_date else 0
                ),
                vendor_prior_late_rate=(
                    float(1 - (vendor.reliability_score or 70) / 100)
                    if vendor else 0.25
                ),
                vendor_prior_orders=50,
            )
        )

    predictions = predictor.predict_many(rows)
    raised = 0

    for order, prediction in zip(open_orders, predictions):
        if prediction["risk_band"] not in ("High", "Critical"):
            continue

        vendor = order.vendor
        probability = prediction["delay_probability"] * 100

        raised += dispatch_to_roles(
            db, SUPPLY_ROLES, NotificationType.DELIVERY,
            f"Delivery at risk: {order.po_number}",
            (
                f"The delay model puts {order.po_number} to "
                f"{vendor.vendor_name if vendor else 'the vendor'} at a "
                f"{probability:.0f}% chance of missing its "
                f"{order.expected_delivery} committed date. Consider "
                f"expediting or re-confirming the date."
            ),
            f"/purchase-orders/{order.id}",
            "High" if prediction["risk_band"] == "Critical" else "Medium",
            f"predicted-delay:{order.id}",
        )

    db.commit()

    return raised


def run_alert_sweep(db: Session) -> dict:
    """Run every sweep and report how many alerts each raised."""

    return {
        "delivery_delays": sweep_delivery_delays(db),
        "contract_expiry": sweep_contract_expiry(db),
        "compliance": sweep_compliance(db),
        "vendor_approvals": sweep_vendor_approvals(db),
        "procurement": sweep_procurement(db),
        "predicted_delays": sweep_predicted_delays(db),
    }


def main():
    from database import SessionLocal

    db = SessionLocal()

    try:
        print("Running the alert sweep ...\n")
        results = run_alert_sweep(db)

        for name, count in results.items():
            print(f"  {name:<20} {count:>5} alert(s)")

        print(f"\n  {'total':<20} {sum(results.values()):>5}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
