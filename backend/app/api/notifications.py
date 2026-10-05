
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract
from app.models.vendor_performance import VendorPerformance
from app.api.reliability import calculate_vendor_reliability
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    NotificationSummary,
)

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)


def normalize_role(role) -> str:
    if hasattr(role, "value"):
        role = role.value
    return str(role or "").strip().upper().replace(" ", "_")


def create_if_missing(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    channel: str = "IN_APP",
    vendor_id: int | None = None,
    source_type: str | None = None,
    source_id: int | None = None,
):
    existing = None

    if source_type and source_id:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.notification_type == notification_type,
                Notification.source_type == source_type,
                Notification.source_id == source_id,
            )
            .first()
        )

    if existing:
        return existing

    notification = Notification(
        user_id=user_id,
        vendor_id=vendor_id,
        notification_type=notification_type,
        title=title,
        message=message,
        channel=channel,
        delivery_status="SENT" if channel == "IN_APP" else "PENDING",
        source_type=source_type,
        source_id=source_id,
    )

    db.add(notification)
    return notification


@router.get(
    "",
    response_model=list[NotificationResponse],
)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.get(
    "/summary",
    response_model=NotificationSummary,
)
def get_notification_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = Notification.user_id == current_user.id

    total = (
        db.query(func.count(Notification.id))
        .filter(base)
        .scalar()
        or 0
    )

    unread = (
        db.query(func.count(Notification.id))
        .filter(
            base,
            Notification.is_read.is_(False),
        )
        .scalar()
        or 0
    )

    def count_type(notification_type: str) -> int:
        return (
            db.query(func.count(Notification.id))
            .filter(
                base,
                Notification.notification_type == notification_type,
            )
            .scalar()
            or 0
        )

    return NotificationSummary(
        total=total,
        unread=unread,
        procurement_alerts=count_type("PROCUREMENT_ALERT"),
        delivery_delays=count_type("DELIVERY_DELAY"),
        vendor_approvals=count_type("VENDOR_APPROVAL"),
        contract_expiry_alerts=count_type("CONTRACT_EXPIRY"),
        compliance_alerts=count_type("COMPLIANCE"),
    )


@router.post(
    "",
    response_model=NotificationResponse,
)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = Notification(
        user_id=data.user_id,
        vendor_id=data.vendor_id,
        notification_type=data.notification_type,
        title=data.title,
        message=data.message,
        channel=data.channel,
        delivery_status="SENT" if data.channel == "IN_APP" else "PENDING",
        source_type=data.source_type,
        source_id=data.source_id,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    notification.is_read = True
    notification.read_at = datetime.utcnow()

    db.commit()
    db.refresh(notification)

    return notification


@router.patch(
    "/read-all",
)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .all()
    )

    now = datetime.utcnow()

    for notification in notifications:
        notification.is_read = True
        notification.read_at = now

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated": len(notifications),
    }


@router.delete(
    "/{notification_id}",
)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    db.delete(notification)
    db.commit()

    return {
        "message": "Notification deleted",
    }


def calculate_evaluation_score(evaluation: VendorPerformance) -> float | None:
    """
    Calculate a performance score from available evaluation factors.
    Missing factors are excluded instead of being treated as zero.
    """
    values = []

    if evaluation.quality_rating is not None:
        values.append(float(evaluation.quality_rating) / 5 * 100)

    if evaluation.service_rating is not None:
        values.append(float(evaluation.service_rating) / 5 * 100)

    if evaluation.response_time_hours is not None:
        response_score = 100 - float(evaluation.response_time_hours) * 5
        values.append(max(0, min(100, response_score)))

    if evaluation.issue_resolution_time_hours is not None:
        resolution_score = (
            100 - float(evaluation.issue_resolution_time_hours) * 2
        )
        values.append(max(0, min(100, resolution_score)))

    if not values:
        return None

    return sum(values) / len(values)


@router.post(
    "/sync",
)
def sync_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate database-backed notifications from procurement,
    vendor, contract, and performance data.

    Vendor users are limited to the vendor record matching
    their account email. Managers retain portfolio-wide alerts.
    """
    role = normalize_role(current_user.role)
    created = 0

    manager_roles = {
        "ADMINISTRATOR",
        "PROCUREMENT_MANAGER",
        "SUPPLY_CHAIN_MANAGER",
    }

    is_vendor_user = role == "VENDOR"

    # Match a Vendor account to its vendor record by email.
    # If no matching vendor exists, the Vendor receives no
    # vendor-specific alerts from this synchronization.
    own_vendor = None
    if is_vendor_user and current_user.email:
        own_vendor = (
            db.query(Vendor)
            .filter(
                func.lower(func.trim(Vendor.email))
                == current_user.email.strip().lower()
            )
            .first()
        )

    # Managers see the full portfolio. Vendor users see only
    # the vendor record linked to their account.
    if is_vendor_user:
        scoped_vendors = [own_vendor] if own_vendor else []
    else:
        scoped_vendors = db.query(Vendor).all()

    scoped_vendor_ids = [
        vendor.id for vendor in scoped_vendors if vendor is not None
    ]

    # 1. Vendor approval notifications for internal managers.
    if role in manager_roles:
        pending_vendors = (
            db.query(Vendor)
            .filter(Vendor.status.ilike("Pending"))
            .all()
        )

        for vendor in pending_vendors:
            notification = create_if_missing(
                db,
                user_id=current_user.id,
                vendor_id=vendor.id,
                notification_type="VENDOR_APPROVAL",
                title="Vendor Approval Required",
                message=f"Vendor '{vendor.name}' is waiting for approval.",
                source_type="VENDOR",
                source_id=vendor.id,
            )

            if notification.id is None:
                created += 1

    # 2. Purchase order / procurement alerts for managers.
    if role in manager_roles:
        pending_orders = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.status.in_(["Pending", "Approved"])
            )
            .all()
        )

        for order in pending_orders:
            notification = create_if_missing(
                db,
                user_id=current_user.id,
                notification_type="PROCUREMENT_ALERT",
                title="Procurement Alert",
                message=(
                    f"Purchase Order {order.po_number} "
                    f"currently has status '{order.status}'."
                ),
                vendor_id=order.vendor_id,
                source_type="PURCHASE_ORDER",
                source_id=order.id,
            )

            if notification.id is None:
                created += 1

    # 3. Delivery delay notifications.
    # Vendor users are restricted to their own vendor's orders.
    today = datetime.utcnow().date()

    delayed_orders_query = db.query(PurchaseOrder).filter(
        PurchaseOrder.expected_delivery_date < today,
        PurchaseOrder.status.notin_(
            ["Delivered", "Completed", "Cancelled"]
        ),
    )

    if is_vendor_user:
        if not scoped_vendor_ids:
            delayed_orders = []
        else:
            delayed_orders = (
                delayed_orders_query
                .filter(PurchaseOrder.vendor_id.in_(scoped_vendor_ids))
                .all()
            )
    else:
        delayed_orders = delayed_orders_query.all()

    for order in delayed_orders:
        notification = create_if_missing(
            db,
            user_id=current_user.id,
            notification_type="DELIVERY_DELAY",
            title="Delivery Delay Alert",
            message=(
                f"Purchase Order {order.po_number} "
                "has passed its expected delivery date."
            ),
            vendor_id=order.vendor_id,
            source_type="DELIVERY",
            source_id=order.id,
        )

        if notification.id is None:
            created += 1

    # 4. Contract expiry notifications.
    expiry_limit = today + timedelta(days=30)

    contracts_query = db.query(Contract).filter(
        Contract.end_date <= expiry_limit,
        Contract.end_date >= today,
    )

    if is_vendor_user:
        if not scoped_vendor_ids:
            contracts = []
        else:
            contracts = (
                contracts_query
                .filter(Contract.vendor_id.in_(scoped_vendor_ids))
                .all()
            )
    else:
        contracts = contracts_query.all()

    for contract in contracts:
        notification = create_if_missing(
            db,
            user_id=current_user.id,
            vendor_id=contract.vendor_id,
            notification_type="CONTRACT_EXPIRY",
            title="Contract Expiry Alert",
            message=(
                f"Contract {contract.contract_number} "
                f"will expire on {contract.end_date}."
            ),
            source_type="CONTRACT",
            source_id=contract.id,
        )

        if notification.id is None:
            created += 1

    # 5. Compliance notifications.
    compliance_query = db.query(Contract).filter(
        Contract.compliance_status.ilike("Non-Compliant")
    )

    if is_vendor_user:
        if not scoped_vendor_ids:
            non_compliant_contracts = []
        else:
            non_compliant_contracts = (
                compliance_query
                .filter(Contract.vendor_id.in_(scoped_vendor_ids))
                .all()
            )
    else:
        non_compliant_contracts = compliance_query.all()

    for contract in non_compliant_contracts:
        notification = create_if_missing(
            db,
            user_id=current_user.id,
            vendor_id=contract.vendor_id,
            notification_type="COMPLIANCE",
            title="Compliance Alert",
            message=(
                f"Contract {contract.contract_number} "
                "requires compliance attention."
            ),
            source_type="COMPLIANCE",
            source_id=contract.id,
        )

        if notification.id is None:
            created += 1

    # 6. Vendor risk alerts.
    # Portfolio-wide risk alerts are for internal managers only.
    if role in manager_roles:
        vendors = (
            db.query(Vendor)
            .order_by(Vendor.name.asc())
            .all()
        )

        for vendor in vendors:
            reliability = calculate_vendor_reliability(vendor, db)

            # A. High-risk vendor alert.
            # Vendors with no factor data are not automatically
            # classified as high risk for alerting purposes.
            if (
                reliability.available_factor_count > 0
                and reliability.reliability_score < 50
            ):
                notification = create_if_missing(
                    db,
                    user_id=current_user.id,
                    vendor_id=vendor.id,
                    notification_type="RISK_ALERT",
                    title="High-Risk Vendor Alert",
                    message=(
                        f"Vendor '{vendor.name}' has a reliability "
                        f"score of {reliability.reliability_score}/100 "
                        "and is classified as High Risk. "
                        f"{reliability.available_factor_count} of "
                        f"{reliability.total_factor_count} reliability "
                        "factors have available data."
                    ),
                    source_type="RISK_HIGH",
                    source_id=vendor.id,
                )

                if notification.id is None:
                    created += 1

            # Fetch the vendor's performance evaluations.
            evaluations = (
                db.query(VendorPerformance)
                .filter(
                    VendorPerformance.vendor_id == vendor.id,
                    VendorPerformance.purchase_order_id.isnot(None),
                )
                .order_by(
                    VendorPerformance.evaluation_date.desc(),
                    VendorPerformance.id.desc(),
                )
                .all()
            )

            # B. Falling performance score alert.
            scored_evaluations = []

            for evaluation in evaluations:
                score = calculate_evaluation_score(evaluation)
                if score is not None:
                    scored_evaluations.append((evaluation, score))

            if len(scored_evaluations) >= 2:
                latest_evaluation, latest_score = scored_evaluations[0]
                previous_evaluation, previous_score = scored_evaluations[1]

                score_drop = previous_score - latest_score

                if score_drop >= 10:
                    notification = create_if_missing(
                        db,
                        user_id=current_user.id,
                        vendor_id=vendor.id,
                        notification_type="RISK_ALERT",
                        title="Vendor Performance Score Falling",
                        message=(
                            f"Vendor '{vendor.name}' performance "
                            f"score decreased from {previous_score:.2f} "
                            f"to {latest_score:.2f}, a drop of "
                            f"{score_drop:.2f} points."
                        ),
                        source_type="RISK_SCORE_DROP",
                        source_id=latest_evaluation.id,
                    )

                    if notification.id is None:
                        created += 1

            # C. Repeated late delivery alert.
            evaluated_deliveries = []

            for evaluation in evaluations:
                if evaluation.actual_delivery_date is None:
                    continue

                order = (
                    db.query(PurchaseOrder)
                    .filter(
                        PurchaseOrder.id == evaluation.purchase_order_id,
                        PurchaseOrder.vendor_id == vendor.id,
                    )
                    .first()
                )

                if order is None or order.expected_delivery_date is None:
                    continue

                evaluated_deliveries.append((evaluation, order))

            latest_three = evaluated_deliveries[:3]

            late_deliveries = [
                (evaluation, order)
                for evaluation, order in latest_three
                if evaluation.actual_delivery_date > order.expected_delivery_date
            ]

            if len(late_deliveries) >= 2:
                latest_late_evaluation = late_deliveries[0][0]

                notification = create_if_missing(
                    db,
                    user_id=current_user.id,
                    vendor_id=vendor.id,
                    notification_type="RISK_ALERT",
                    title="Repeated Late Deliveries",
                    message=(
                        f"Vendor '{vendor.name}' has "
                        f"{len(late_deliveries)} late deliveries "
                        "among the latest 3 evaluated deliveries."
                    ),
                    source_type="RISK_LATE_DELIVERY",
                    source_id=latest_late_evaluation.id,
                )

                if notification.id is None:
                    created += 1

            # D. Recorded issue alert.
            # The current model does not track whether issues
            # are open or resolved.
            for evaluation in evaluations:
                if (evaluation.issue_count or 0) <= 0:
                    continue

                notification = create_if_missing(
                    db,
                    user_id=current_user.id,
                    vendor_id=vendor.id,
                    notification_type="RISK_ALERT",
                    title="Vendor Issues Recorded",
                    message=(
                        f"Performance evaluation for vendor "
                        f"'{vendor.name}' records "
                        f"{evaluation.issue_count} issue(s). "
                        "Issue status is not tracked in the current "
                        "data model, so resolution status is unknown."
                    ),
                    source_type="RISK_RECORDED_ISSUE",
                    source_id=evaluation.id,
                )

                if notification.id is None:
                    created += 1

    db.commit()

    return {
        "message": "Notification synchronization completed",
        "created": created,
    }