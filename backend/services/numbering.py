"""Human-readable document number generation (VND-0001, PR-2026-0001, ...)."""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Contract, Invoice, ProcurementRequest, PurchaseOrder, Vendor


def _next_sequence(db: Session, model, column, prefix: str) -> int:
    """Highest numeric suffix currently in use for ``prefix``, plus one."""
    count = (
        db.query(func.count(model.id))
        .filter(column.like(f"{prefix}%"))
        .scalar()
    ) or 0

    candidate = count + 1

    # Guard against gaps/duplicates left behind by deletions.
    while db.query(model.id).filter(column == f"{prefix}{candidate:04d}").first():
        candidate += 1

    return candidate


def next_vendor_code(db: Session) -> str:
    prefix = "VND-"
    return f"{prefix}{_next_sequence(db, Vendor, Vendor.vendor_code, prefix):04d}"


def next_request_number(db: Session) -> str:
    prefix = f"PR-{date.today().year}-"
    seq = _next_sequence(
        db, ProcurementRequest, ProcurementRequest.request_number, prefix
    )
    return f"{prefix}{seq:04d}"


def next_po_number(db: Session) -> str:
    prefix = f"PO-{date.today().year}-"
    seq = _next_sequence(db, PurchaseOrder, PurchaseOrder.po_number, prefix)
    return f"{prefix}{seq:04d}"


def next_contract_number(db: Session) -> str:
    prefix = f"CT-{date.today().year}-"
    seq = _next_sequence(db, Contract, Contract.contract_number, prefix)
    return f"{prefix}{seq:04d}"


def next_invoice_number(db: Session) -> str:
    prefix = f"INV-{date.today().year}-"
    seq = _next_sequence(db, Invoice, Invoice.invoice_number, prefix)
    return f"{prefix}{seq:04d}"
