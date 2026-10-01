from pathlib import Path
import re
import os

ROOT = Path(os.environ.get(
    "VENDORIQ_ROOT",
    Path.home() / "Downloads/project2-kd/vendoriq"
))
B = ROOT / "backend/app"
F = ROOT / "frontend/src/app"

# ---------------------------------------------------------
# Performance service — response time
# ---------------------------------------------------------
p = B / "services/performance_service.py"
s = p.read_text()

m = re.search(
    r"def compute_response_time_hours\(.*?\n\n\ndef compute_issue_resolution_hours",
    s,
    re.S,
)

if not m:
    raise SystemExit("performance_service.py response function not found")

new = '''def compute_response_time_hours(db: Session, vendor_id: UUID) -> Optional[float]:
    """Average time between an organization message and the vendor's next reply."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return None

    messages = (
        db.query(Message)
        .filter(Message.vendor_id == vendor_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    if len(messages) < 2:
        return None

    vendor_user_id = vendor.user_id
    cache = {}
    deltas = []
    pending_staff_time = None

    for message in messages:
        is_vendor_reply = False

        if vendor_user_id and message.sender_id == vendor_user_id:
            is_vendor_reply = True

        elif not vendor_user_id:
            sender = cache.get(message.sender_id)

            if sender is None:
                sender = (
                    db.query(User)
                    .filter(User.id == message.sender_id)
                    .first()
                )
                cache[message.sender_id] = sender

            is_vendor_reply = bool(
                sender and sender.role == UserRole.VENDOR
            )

        if is_vendor_reply:
            if pending_staff_time is not None:
                delta = (
                    message.created_at - pending_staff_time
                ).total_seconds() / 3600.0

                if delta >= 0:
                    deltas.append(delta)

            pending_staff_time = None

        else:
            pending_staff_time = message.created_at

    return round(sum(deltas) / len(deltas), 2) if deltas else None


def compute_issue_resolution_hours'''

s = s[:m.start()] + new + s[m.end():]
p.write_text(s)


# ---------------------------------------------------------
# Vendor approval notification
# ---------------------------------------------------------
p = B / "api/v1/endpoints/vendors.py"
s = p.read_text()

s = s.replace(
    "from app.core.utils import log_activity, notify_user",
    "from app.core.utils import log_activity, notify_user\n"
    "from app.services.notification_service import notify_event",
)

s = s.replace(
'''    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "vendor_approval",
            f"Your vendor profile is now {payload.status.value}",
            payload.approval_notes,
            "vendor",
            vendor.id,
        )''',
'''    if vendor.user_id:
        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user:
            notify_event(
                db,
                vendor_user,
                "vendor_approval",
                f"Your vendor profile is now {payload.status.value}",
                payload.approval_notes
                or f"Vendor status changed to {payload.status.value}.",
                "vendor",
                vendor.id,
            )''',
)

p.write_text(s)


# ---------------------------------------------------------
# Procurement approval + vendor assignment
# ---------------------------------------------------------
p = B / "api/v1/endpoints/procurement.py"
s = p.read_text()

s = s.replace(
    "from app.core.utils import generate_code, log_activity, notify_user",
    "from app.core.utils import generate_code, log_activity, notify_user\n"
    "from app.services.notification_service import notify_event\n"
    "from app.models.vendor import Vendor, VendorStatus\n"
    "from app.services import reliability_service",
)

s = s.replace(
'''    notify_user(
        db, request.requested_by_id, "procurement_alert",
        f"Your request '{request.title}' was {payload.status.value}",
        payload.approval_notes, "procurement_request", request.id,
    )''',
'''    requester = (
        db.query(User)
        .filter(User.id == request.requested_by_id)
        .first()
    )

    if requester:
        notify_event(
            db,
            requester,
            "procurement_approval",
            f"Your request '{request.title}' was {payload.status.value}",
            payload.approval_notes
            or f"Procurement request status changed to {payload.status.value}.",
            "procurement_request",
            request.id,
        )''',
)

old = '''def assign_vendor(
    request_id: int,
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvers),
):
    """Vendor Assignment for an approved procurement request."""
    request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    request.assigned_vendor_id = vendor_id
    db.commit()
    db.refresh(request)
    return request'''

new = '''def assign_vendor(
    request_id: int,
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvers),
):
    """Assign only an approved/active vendor, guided by reliability data."""

    request = (
        db.query(ProcurementRequest)
        .filter(ProcurementRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found",
        )

    if request.status not in (
        ProcurementStatus.APPROVED,
        ProcurementStatus.ORDERED,
    ):
        raise HTTPException(
            status_code=400,
            detail="Only approved or ordered requests can have a vendor assigned",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if (
        vendor.status not in
        (VendorStatus.APPROVED, VendorStatus.ACTIVE)
        or not vendor.is_active
    ):
        raise HTTPException(
            status_code=400,
            detail="Only approved and active vendors can be assigned",
        )

    latest = reliability_service.get_latest_score(db, vendor.id)

    request.assigned_vendor_id = vendor.id

    db.commit()
    db.refresh(request)

    recommendation = (
        latest.recommendation
        if latest
        else "No reliability score calculated yet. Review vendor before assignment."
    )

    log_activity(
        db,
        current_user.id,
        "vendor_assigned",
        "procurement_request",
        request.id,
        f"Assigned {vendor.company_name}; "
        f"reliability={latest.score if latest else 'N/A'}; "
        f"risk={latest.risk_level.value if latest else 'N/A'}; "
        f"recommendation={recommendation}",
    )

    requester = (
        db.query(User)
        .filter(User.id == request.requested_by_id)
        .first()
    )

    if requester and requester.id != current_user.id:
        notify_event(
            db,
            requester,
            "vendor_assignment",
            f"Vendor assigned to {request.request_number}",
            f"{vendor.company_name} was assigned. "
            f"Reliability: {latest.score if latest else 'N/A'}; "
            f"risk: {latest.risk_level.value if latest else 'N/A'}. "
            f"{recommendation}",
            "procurement_request",
            request.id,
        )

    return request'''

if old not in s:
    raise SystemExit("procurement assign_vendor block not found")

s = s.replace(old, new)
p.write_text(s)


# ---------------------------------------------------------
# Purchase order notifications
# ---------------------------------------------------------
p = B / "api/v1/endpoints/purchase_orders.py"
s = p.read_text()

s = s.replace(
    "from app.core.utils import generate_code, log_activity, notify_user",
    "from app.core.utils import generate_code, log_activity, notify_user\n"
    "from app.services.notification_service import notify_event",
)

s = s.replace(
'''    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "procurement_alert",
            f"New Purchase Order {po.po_number}",
            "A new PO has been issued to you.",
            "purchase_order",
            po.id,
        )''',
'''    if vendor.user_id:
        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user:
            notify_event(
                db,
                vendor_user,
                "purchase_order_created",
                f"New Purchase Order {po.po_number}",
                "A new PO has been issued to you.",
                "purchase_order",
                po.id,
            )''',
)

s = s.replace(
'''    if vendor and vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "delivery_alert",
            f"PO {po.po_number} status: {payload.status.value}",
            None,
            "purchase_order",
            po.id,
        )''',
'''    if vendor and vendor.user_id:
        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user:
            event_type = (
                "delivery_update"
                if payload.status in
                (POStatus.DELIVERED, POStatus.COMPLETED)
                else "purchase_order_status"
            )

            notify_event(
                db,
                vendor_user,
                event_type,
                f"PO {po.po_number} status: {payload.status.value}",
                f"Purchase order {po.po_number} is now {payload.status.value}.",
                "purchase_order",
                po.id,
            )''',
)

p.write_text(s)


# ---------------------------------------------------------
# Issue notifications
# ---------------------------------------------------------
p = B / "api/v1/endpoints/performance.py"
s = p.read_text()

s = s.replace(
    "from app.core.utils import log_activity",
    "from app.core.utils import log_activity\n"
    "from app.services.notification_service import notify_event",
)

s = s.replace(
    "from app.models.user import User",
    "from app.models.user import User, UserRole",
)

s = s.replace(
'''    log_activity(
        db,
        current_user.id,
        "issue_raised",
        "vendor",
        vendor.id,
        payload.title,
    )
    return issue''',
'''    log_activity(
        db,
        current_user.id,
        "issue_raised",
        "vendor",
        vendor.id,
        payload.title,
    )

    recipients = (
        db.query(User)
        .filter(
            User.role.in_([
                UserRole.ADMIN,
                UserRole.PROCUREMENT_MANAGER,
            ])
        )
        .all()
    )

    if vendor.user_id:
        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user and vendor_user.id != current_user.id:
            recipients.append(vendor_user)

    seen = set()

    for recipient in recipients:
        if recipient.id in seen:
            continue

        seen.add(recipient.id)

        notify_event(
            db,
            recipient,
            "compliance_issue",
            f"Vendor issue raised: {issue.title}",
            issue.description or "A vendor issue requires attention.",
            "issue",
            issue.id,
        )

    return issue''',
)

s = s.replace(
'''    log_activity(
        db,
        current_user.id,
        "issue_resolved",
        "vendor",
        issue.vendor_id,
        f"Issue #{issue.id} resolved",
    )
    return issue''',
'''    log_activity(
        db,
        current_user.id,
        "issue_resolved",
        "vendor",
        issue.vendor_id,
        f"Issue #{issue.id} resolved",
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == issue.vendor_id)
        .first()
    )

    if vendor and vendor.user_id:
        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user:
            notify_event(
                db,
                vendor_user,
                "compliance_issue_resolved",
                f"Vendor issue #{issue.id} resolved",
                issue.resolution_notes
                or "The reported issue has been resolved.",
                "issue",
                issue.id,
            )

    return issue''',
)

p.write_text(s)


# ---------------------------------------------------------
# Frontend procurement service
# ---------------------------------------------------------
p = F / "core/services/procurement.service.ts"

s = p.read_text().replace(
    "assignVendor(id: number, vendorId: number): Observable<ProcurementRequest> {",
    "assignVendor(id: number, vendorId: string | number): Observable<ProcurementRequest> {",
)

p.write_text(s)


# ---------------------------------------------------------
# Frontend procurement component
# ---------------------------------------------------------
p = F / "features/procurement/procurement.component.ts"
s = p.read_text()

s = s.replace(
    "rankingByVendorId: Record<number, VendorRankingEntry> = {};",
    "rankingByVendorId: Record<string, VendorRankingEntry> = {};",
)

s = s.replace(
    "this.rankingByVendorId[e.vendor_id] = e;",
    "this.rankingByVendorId[String(e.vendor_id)] = e;",
)

s = s.replace(
    "const r = this.rankingByVendorId[v.id];",
    "const r = this.rankingByVendorId[String(v.id)];",
)

s = s.replace(
    "return r ? `${v.company_name} — ${r.risk_level} risk (${r.score})` : v.company_name;",
    "return r ? `${v.company_name} — ${r.score} (${r.risk_level} risk)` : v.company_name;",
)

s = s.replace(
    "this.procurementService.assignVendor(req.id, Number(vendorId)).subscribe(() => this.load());",
    "this.procurementService.assignVendor(req.id, vendorId).subscribe(() => this.load());",
)

p.write_text(s)


# ---------------------------------------------------------
# Frontend procurement HTML
# ---------------------------------------------------------
p = F / "features/procurement/procurement.component.html"
s = p.read_text()

s = s.replace(
'''          <th>Assign Vendor</th>
          <th class="text-end">Actions</th>''',
'''          <th>Assign Vendor</th>
          <th>Reliability / Recommendation</th>
          <th class="text-end">Actions</th>''',
)

s = s.replace(
'''              <option *ngFor="let v of vendors" [value]="v.id">{{ vendorOptionLabel(v) }}</option>
            </select>
          </td>
          <td class="text-end">''',
'''              <option *ngFor="let v of vendors" [value]="v.id">{{ vendorOptionLabel(v) }}</option>
            </select>
            <small class="text-muted d-block mt-1">
              Only approved/active vendors are selectable.
            </small>
          </td>
          <td>
            <ng-container
              *ngIf="r.assigned_vendor_id && recommendationForVendor(r.assigned_vendor_id) as rec; else noRec">

              <span
                class="badge"
                [ngClass]="
                  rec.risk_level === 'low'
                    ? 'bg-success'
                    : rec.risk_level === 'medium'
                      ? 'bg-warning text-dark'
                      : 'bg-danger'
                ">

                {{ rec.score }} · {{ rec.risk_level | uppercase }}

              </span>

              <div class="small text-muted mt-1">
                {{ rec.recommendation }}
              </div>

            </ng-container>

            <ng-template #noRec>
              <span class="text-muted small">
                No reliability score yet
              </span>
            </ng-template>
          </td>
          <td class="text-end">''',
)

s = s.replace(
    '<td colspan="7" class="text-center text-muted py-4">',
    '<td colspan="8" class="text-center text-muted py-4">',
)

p.write_text(s)

print("patched")
