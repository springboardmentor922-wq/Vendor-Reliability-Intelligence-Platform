"""Spreadsheet import: turn an uploaded Excel / CSV file into platform records.

Two kinds of file are understood.

**Platform workbook** - one sheet per record type (Vendors, Purchase Orders,
Contracts, Invoices, Certifications, Procurement Requests, Performance). The
downloadable template shows the exact layout, but sheet and column names are
matched loosely ("Supplier Name", "vendor_name" and "Vendor" all land on the
same field), so an organisation's own export usually imports as-is.

**DataCo supply-chain file** - the raw dataset the delay model was trained
on. It is handed to the existing ETL (``etl.load_dataco``), which rebuilds the
dataset-derived order history exactly as the command-line loader does.

Every row runs inside its own savepoint, so a bad row is reported with its
sheet and row number and skipped without losing the rest of the file. A
preview is the same import run inside a transaction that is rolled back, which
means the preview's error list is exactly what a real import would report.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Optional

import pandas as pd
from sqlalchemy.orm import Session

from config import settings
from models import (
    Contract,
    ContractStatus,
    Invoice,
    InvoiceStatus,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    User,
    Vendor,
    VendorApproval,
    VendorCategory,
    VendorCertification,
    VendorPerformance,
    VendorStatus,
)
from services.numbering import (
    next_contract_number,
    next_invoice_number,
    next_po_number,
    next_request_number,
    next_vendor_code,
)

MAX_ERRORS_REPORTED = 200


# --------------------------------------------------------------------------
# Name matching
# --------------------------------------------------------------------------

def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


SHEET_ALIASES: dict[str, list[str]] = {
    "vendors": ["vendors", "vendor", "suppliers", "supplier", "vendor_master", "supplier_master", "vendor_list"],
    "certifications": ["certifications", "certification", "certificates", "vendor_certifications", "compliance_certificates"],
    "procurement_requests": ["procurement_requests", "procurement_request", "requests", "purchase_requests", "requisitions", "purchase_requisitions", "prs"],
    "purchase_orders": ["purchase_orders", "purchase_order", "pos", "po", "orders", "order_lines", "po_lines"],
    "invoices": ["invoices", "invoice", "bills", "vendor_invoices"],
    "contracts": ["contracts", "contract", "agreements", "vendor_contracts"],
    "performance": ["performance", "vendor_performance", "quality", "evaluations", "quality_evaluations"],
}

# Import order matters: vendors must exist before anything points at them.
ENTITY_ORDER = ["vendors", "certifications", "procurement_requests", "purchase_orders", "invoices", "contracts", "performance"]

ENTITY_LABELS = {
    "vendors": "Vendors",
    "certifications": "Certifications",
    "procurement_requests": "Procurement Requests",
    "purchase_orders": "Purchase Orders",
    "invoices": "Invoices",
    "contracts": "Contracts",
    "performance": "Performance",
}

VENDOR_REF = ["vendor", "vendor_name", "supplier", "supplier_name", "vendor_code", "supplier_code", "vendor_id"]

FIELD_ALIASES: dict[str, dict[str, list[str]]] = {
    "vendors": {
        "vendor_code": ["vendor_code", "supplier_code", "code", "vendor_id"],
        "vendor_name": ["vendor_name", "supplier_name", "vendor", "supplier", "name", "company_name", "company"],
        "category": ["category", "vendor_category", "supplier_category", "type", "vendor_type"],
        "status": ["status", "vendor_status", "approval_status"],
        "contact_person": ["contact_person", "contact", "contact_name", "representative"],
        "email": ["email", "email_address", "contact_email"],
        "phone": ["phone", "phone_number", "telephone", "mobile", "contact_phone"],
        "website": ["website", "web", "url"],
        "address": ["address", "street", "address_line_1"],
        "city": ["city", "town"],
        "state": ["state", "province", "region"],
        "postal_code": ["postal_code", "pincode", "pin_code", "zip", "zip_code"],
        "country": ["country"],
        "tax_id": ["tax_id", "gstin", "gst", "gst_number", "vat", "vat_number", "tin"],
        "registration_number": ["registration_number", "registration_no", "cin", "company_registration"],
        "company_type": ["company_type", "business_type", "legal_structure"],
        "year_established": ["year_established", "established", "founded"],
        "products_services": ["products_services", "products", "services", "products_and_services", "offerings"],
        "risk_level": ["risk_level", "risk"],
        "notes": ["notes", "remarks", "comments"],
    },
    "certifications": {
        "vendor": VENDOR_REF,
        "certification_name": ["certification_name", "certification", "certificate", "name", "standard"],
        "issuing_authority": ["issuing_authority", "authority", "issuer", "issued_by"],
        "certificate_number": ["certificate_number", "certificate_no", "number"],
        "issue_date": ["issue_date", "issued_on", "valid_from"],
        "expiry_date": ["expiry_date", "expiry", "expires_on", "valid_until", "valid_to"],
    },
    "procurement_requests": {
        "request_number": ["request_number", "request_no", "pr_number", "requisition_number"],
        "item": ["item", "item_name", "product", "product_name", "description_short", "title"],
        "description": ["description", "details"],
        "category": ["category", "vendor_category"],
        "quantity": ["quantity", "qty"],
        "unit": ["unit", "uom"],
        "estimated_cost": ["estimated_cost", "estimate", "budget", "cost", "amount"],
        "currency": ["currency"],
        "required_date": ["required_date", "required_by", "need_by", "due_date"],
        "priority": ["priority"],
        "department": ["department", "requesting_department", "dept"],
        "justification": ["justification", "reason"],
        "status": ["status"],
        "vendor": VENDOR_REF,
    },
    "purchase_orders": {
        "po_number": ["po_number", "po_no", "po", "purchase_order", "purchase_order_number", "order_number", "order_id"],
        "vendor": VENDOR_REF,
        "request_number": ["request_number", "pr_number", "procurement_request"],
        "title": ["title", "po_title", "subject"],
        "department": ["department", "dept"],
        "order_date": ["order_date", "po_date", "date", "ordered_on"],
        "expected_delivery": ["expected_delivery", "expected_delivery_date", "delivery_date", "due_date", "promised_date"],
        "actual_delivery": ["actual_delivery", "actual_delivery_date", "delivered_on", "received_date", "received_on"],
        "status": ["status", "po_status", "order_status"],
        "currency": ["currency"],
        "payment_terms": ["payment_terms", "terms"],
        "shipping_address": ["shipping_address", "ship_to", "delivery_address"],
        "billing_address": ["billing_address", "bill_to"],
        "item_name": ["item_name", "item", "item_description", "product", "product_name", "description"],
        "quantity": ["quantity", "qty"],
        "unit": ["unit", "uom"],
        "unit_price": ["unit_price", "price", "rate", "unit_cost"],
        "tax_rate": ["tax_rate", "tax", "tax_percent", "gst_rate", "gst"],
        "line_total": ["line_total", "total", "amount", "total_amount", "value"],
        "quality_rating": ["quality_rating", "quality", "rating"],
        "notes": ["notes", "remarks"],
    },
    "invoices": {
        "invoice_number": ["invoice_number", "invoice_no", "invoice", "bill_number"],
        "po_number": ["po_number", "po_no", "po", "purchase_order"],
        "vendor": VENDOR_REF,
        "invoice_date": ["invoice_date", "date", "bill_date"],
        "due_date": ["due_date", "due"],
        "amount": ["amount", "invoice_amount", "net_amount", "subtotal"],
        "tax_amount": ["tax_amount", "tax", "gst_amount"],
        "total_amount": ["total_amount", "total", "gross_amount"],
        "currency": ["currency"],
        "status": ["status", "payment_status"],
        "payment_date": ["payment_date", "paid_on"],
        "notes": ["notes", "remarks"],
    },
    "contracts": {
        "contract_number": ["contract_number", "contract_no", "contract_id", "agreement_number"],
        "vendor": VENDOR_REF,
        "title": ["title", "contract_title", "name"],
        "contract_type": ["contract_type", "type"],
        "start_date": ["start_date", "start", "effective_date", "valid_from"],
        "expiry_date": ["expiry_date", "end_date", "expiry", "valid_to", "valid_until"],
        "contract_value": ["contract_value", "value", "amount"],
        "currency": ["currency"],
        "status": ["status", "contract_status"],
        "compliance_status": ["compliance_status", "compliance"],
        "auto_renew": ["auto_renew", "auto_renewal"],
        "renewal_notice_days": ["renewal_notice_days", "notice_days", "notice_period"],
        "terms": ["terms", "terms_and_conditions"],
    },
    "performance": {
        "vendor": VENDOR_REF,
        "po_number": ["po_number", "po_no", "purchase_order"],
        "evaluation_date": ["evaluation_date", "date", "evaluated_on"],
        "quality_rating": ["quality_rating", "quality", "rating"],
        "service_rating": ["service_rating", "service"],
        "response_time": ["response_time", "response_time_hours", "response_hours"],
        "issue_resolution_time": ["issue_resolution_time", "resolution_time", "resolution_hours"],
        "remarks": ["remarks", "notes", "comments"],
    },
}

REQUIRED: dict[str, list[str]] = {
    "vendors": ["vendor_name", "category"],
    "certifications": ["vendor", "certification_name"],
    "procurement_requests": ["item", "quantity"],
    "purchase_orders": ["vendor"],
    "invoices": ["amount"],
    "contracts": ["vendor", "start_date", "expiry_date"],
    "performance": ["vendor", "quality_rating"],
}

DATACO_SIGNATURE = {"days_for_shipping_real", "days_for_shipment_scheduled", "late_delivery_risk", "order_item_quantity", "shipping_mode"}

CATEGORY_LOOKUP = {norm(c): c for c in VendorCategory.ALL}
CATEGORY_LOOKUP.update({
    "raw_material": "Raw Material Suppliers", "raw_materials": "Raw Material Suppliers", "raw_material_supplier": "Raw Material Suppliers",
    "equipment": "Equipment Vendors", "equipment_vendor": "Equipment Vendors",
    "it": "IT Vendors", "it_vendor": "IT Vendors", "information_technology": "IT Vendors", "technology": "IT Vendors", "software": "IT Vendors",
    "services": "Service Providers", "service": "Service Providers", "service_provider": "Service Providers",
    "logistics": "Logistics Partners", "logistics_partner": "Logistics Partners", "transport": "Logistics Partners", "shipping": "Logistics Partners",
    "maintenance": "Maintenance Vendors", "maintenance_vendor": "Maintenance Vendors", "facilities": "Maintenance Vendors",
})


# --------------------------------------------------------------------------
# Value coercion
# --------------------------------------------------------------------------

class RowError(ValueError):
    pass


def _blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    if value is pd.NaT:
        return True
    return isinstance(value, str) and not value.strip()


def as_text(value: Any, max_len: Optional[int] = None) -> Optional[str]:
    if _blank(value):
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text[:max_len] if max_len else text


def as_decimal(value: Any, field_name: str) -> Optional[Decimal]:
    if _blank(value):
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    if cleaned in ("", "-", "."):
        raise RowError(f"'{value}' is not a number ({field_name})")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        raise RowError(f"'{value}' is not a number ({field_name})")


def as_date(value: Any, field_name: str) -> Optional[date]:
    if _blank(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, (int, float)) and 20000 < float(value) < 80000:
        # Excel serial date that arrived as a number.
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    parsed = pd.to_datetime(str(value).strip(), errors="coerce", dayfirst=False)
    if pd.isna(parsed):
        parsed = pd.to_datetime(str(value).strip(), errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        raise RowError(f"'{value}' is not a recognisable date ({field_name})")
    return parsed.date()


def as_bool(value: Any) -> bool:
    if _blank(value):
        return False
    return norm(value) in ("yes", "y", "true", "1", "t")


def pick(choices: list[str], value: Any, field_name: str, default: Optional[str] = None) -> Optional[str]:
    if _blank(value):
        return default
    lookup = {norm(c): c for c in choices}
    key = norm(value)
    if key in lookup:
        return lookup[key]
    raise RowError(f"'{value}' is not a valid {field_name}; expected one of {', '.join(choices)}")


def as_category(value: Any) -> str:
    if _blank(value):
        raise RowError("category is required")
    key = norm(value)
    if key in CATEGORY_LOOKUP:
        return CATEGORY_LOOKUP[key]
    for known_key, category in CATEGORY_LOOKUP.items():
        if key and (key in known_key or known_key in key):
            return category
    raise RowError(f"'{value}' is not a vendor category; use one of {', '.join(VendorCategory.ALL)}")


# --------------------------------------------------------------------------
# Result bookkeeping
# --------------------------------------------------------------------------

@dataclass
class SheetResult:
    sheet: str
    entity: str
    rows: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    mapped_columns: dict[str, str] = field(default_factory=dict)
    ignored_columns: list[str] = field(default_factory=list)
    sample: list[dict] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "sheet": self.sheet,
            "entity": self.entity,
            "entity_label": ENTITY_LABELS.get(self.entity, self.entity),
            "rows": self.rows,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "mapped_columns": self.mapped_columns,
            "ignored_columns": self.ignored_columns,
            "sample": self.sample,
        }


@dataclass
class ImportReport:
    file_name: str
    file_format: str
    mode: str = "workbook"
    sheets: list[SheetResult] = field(default_factory=list)
    unrecognised_sheets: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    error_count: int = 0
    notes: list[str] = field(default_factory=list)
    committed: bool = False
    post_processing: dict = field(default_factory=dict)

    def error(self, sheet: str, row: int, message: str) -> None:
        self.error_count += 1
        if len(self.errors) < MAX_ERRORS_REPORTED:
            self.errors.append({"sheet": sheet, "row": row, "message": message})

    @property
    def totals(self) -> dict:
        return {
            "rows": sum(s.rows for s in self.sheets),
            "created": sum(s.created for s in self.sheets),
            "updated": sum(s.updated for s in self.sheets),
            "skipped": sum(s.skipped for s in self.sheets),
            "errors": self.error_count,
        }

    def as_dict(self) -> dict:
        return {
            "file_name": self.file_name,
            "file_format": self.file_format,
            "mode": self.mode,
            "committed": self.committed,
            "totals": self.totals,
            "sheets": [s.as_dict() for s in self.sheets],
            "unrecognised_sheets": self.unrecognised_sheets,
            "errors": self.errors,
            "notes": self.notes,
            "post_processing": self.post_processing,
        }


# --------------------------------------------------------------------------
# File reading
# --------------------------------------------------------------------------

def read_frames(content: bytes, file_name: str) -> tuple[str, dict[str, pd.DataFrame]]:
    lower = file_name.lower()

    if lower.endswith(".csv") or lower.endswith(".txt"):
        for encoding in ("utf-8-sig", "latin-1"):
            try:
                frame = pd.read_csv(io.BytesIO(content), encoding=encoding, low_memory=False)
                return "csv", {file_name.rsplit(".", 1)[0]: frame}
            except UnicodeDecodeError:
                continue
        raise ValueError("The CSV file could not be decoded")

    if lower.endswith((".xlsx", ".xlsm", ".xls")):
        engine = "openpyxl" if not lower.endswith(".xls") else None
        try:
            sheets = pd.read_excel(io.BytesIO(content), sheet_name=None, engine=engine)
        except ImportError:
            raise ValueError("Legacy .xls files are not supported - save the workbook as .xlsx and upload again")
        return "xlsx", sheets

    raise ValueError("Upload an Excel workbook (.xlsx) or a CSV file")


def is_dataco(frames: dict[str, pd.DataFrame]) -> Optional[str]:
    for name, frame in frames.items():
        if DATACO_SIGNATURE.issubset({norm(c) for c in frame.columns}):
            return name
    return None


def detect_entity(sheet_name: str, columns: list[str]) -> Optional[str]:
    key = norm(sheet_name)
    for entity, aliases in SHEET_ALIASES.items():
        if key in aliases:
            return entity
    for entity, aliases in SHEET_ALIASES.items():
        if any(alias in key for alias in aliases if len(alias) > 3):
            return entity

    # Fall back to the columns: pick the entity whose fields match best.
    cols = {norm(c) for c in columns}
    best, best_score = None, 0
    for entity, fields in FIELD_ALIASES.items():
        hits = sum(1 for aliases in fields.values() if cols.intersection(aliases))
        required_ok = all(cols.intersection(fields[r]) for r in REQUIRED[entity])
        score = hits + (3 if required_ok else 0)
        if score > best_score:
            best, best_score = entity, score
    return best if best_score >= 5 else None


def map_columns(entity: str, columns: list[str]) -> tuple[dict[str, str], list[str]]:
    """``{canonical_field: source_column}`` plus the columns left unused."""

    mapping: dict[str, str] = {}
    used: set[str] = set()
    normalised = {c: norm(c) for c in columns}

    # First pass: exact alias hits, in alias priority order.
    for canonical, aliases in FIELD_ALIASES[entity].items():
        for alias in aliases:
            match = next((c for c, n in normalised.items() if n == alias and c not in used), None)
            if match is not None:
                mapping[canonical] = match
                used.add(match)
                break

    ignored = [str(c) for c in columns if c not in used and not str(c).startswith("Unnamed")]
    return mapping, ignored


# --------------------------------------------------------------------------
# The importer
# --------------------------------------------------------------------------

class Importer:
    def __init__(self, db: Session, user: User, report: ImportReport):
        self.db = db
        self.user = user
        self.report = report
        self.today = date.today()
        self._vendor_by_code: dict[str, Vendor] = {}
        self._vendor_by_name: dict[str, Vendor] = {}
        self._po_by_number: dict[str, PurchaseOrder] = {}
        self._request_by_number: dict[str, ProcurementRequest] = {}
        self.touched_vendors: set[int] = set()
        for vendor in db.query(Vendor).all():
            self._remember_vendor(vendor)

    # ---- lookups ----------------------------------------------------------
    def _remember_vendor(self, vendor: Vendor) -> None:
        self._vendor_by_code[vendor.vendor_code.upper()] = vendor
        self._vendor_by_name[vendor.vendor_name.strip().lower()] = vendor

    def vendor(self, ref: Any) -> Vendor:
        text = as_text(ref)
        if not text:
            raise RowError("vendor is required")
        found = self._vendor_by_code.get(text.upper()) or self._vendor_by_name.get(text.lower())
        if found is None and text.isdigit():
            found = self.db.query(Vendor).filter(Vendor.id == int(text)).first()
        if found is None:
            raise RowError(f"vendor '{text}' was not found - add it to the Vendors sheet or register it first")
        return found

    def purchase_order(self, number: Any) -> Optional[PurchaseOrder]:
        text = as_text(number)
        if not text:
            return None
        if text in self._po_by_number:
            return self._po_by_number[text]
        po = self.db.query(PurchaseOrder).filter(PurchaseOrder.po_number == text).first()
        if po:
            self._po_by_number[text] = po
        return po

    def request(self, number: Any) -> Optional[ProcurementRequest]:
        text = as_text(number)
        if not text:
            return None
        if text in self._request_by_number:
            return self._request_by_number[text]
        found = self.db.query(ProcurementRequest).filter(ProcurementRequest.request_number == text).first()
        if found:
            self._request_by_number[text] = found
        return found

    # ---- driver ------------------------------------------------------------
    def run_sheet(self, entity: str, sheet: str, frame: pd.DataFrame) -> SheetResult:
        frame = frame.dropna(how="all")
        mapping, ignored = map_columns(entity, list(frame.columns))
        result = SheetResult(sheet=sheet, entity=entity, rows=len(frame), mapped_columns=mapping, ignored_columns=ignored)

        missing = [r for r in REQUIRED[entity] if r not in mapping]
        if missing:
            result.skipped = len(frame)
            self.report.error(sheet, 1, f"Missing required column(s): {', '.join(missing)}")
            return result

        records = []
        for position, (_, raw) in enumerate(frame.iterrows()):
            record = {canonical: raw[source] for canonical, source in mapping.items()}
            records.append((position + 2, record))  # +2: header row, 1-based

        result.sample = [
            {k: (None if _blank(v) else (v.isoformat() if hasattr(v, "isoformat") else (float(v) if isinstance(v, (int, float, Decimal)) else str(v))))
             for k, v in rec.items()}
            for _, rec in records[:5]
        ]

        handler: Callable = getattr(self, f"import_{entity}")

        if entity == "purchase_orders":
            self._run_grouped_orders(sheet, records, result)
            return result

        for row_number, record in records:
            savepoint = self.db.begin_nested()
            try:
                outcome = handler(record)
                self.db.flush()
                savepoint.commit()
                if outcome == "updated":
                    result.updated += 1
                elif outcome == "skipped":
                    result.skipped += 1
                else:
                    result.created += 1
            except Exception as exc:  # noqa: BLE001 - reported per row
                savepoint.rollback()
                result.skipped += 1
                self.report.error(sheet, row_number, self._message(exc))

        return result

    @staticmethod
    def _message(exc: Exception) -> str:
        if isinstance(exc, RowError):
            return str(exc)
        text = str(getattr(exc, "orig", exc)).split("\n")[0]
        return text[:240]

    # ---- vendors -------------------------------------------------------------
    def import_vendors(self, r: dict) -> str:
        name = as_text(r.get("vendor_name"), 150)
        if not name or len(name) < 2:
            raise RowError("vendor_name is required")

        category = as_category(r.get("category"))
        code = as_text(r.get("vendor_code"), 30)
        status_value = pick(VendorStatus.ALL, r.get("status"), "vendor status", VendorStatus.APPROVED)
        risk = pick(["Low", "Medium", "High", "Critical"], r.get("risk_level"), "risk level", None)

        existing = (self._vendor_by_code.get(code.upper()) if code else None) or self._vendor_by_name.get(name.lower())

        fields = {
            "vendor_name": name,
            "category": category,
            "contact_person": as_text(r.get("contact_person"), 120),
            "email": as_text(r.get("email"), 255),
            "phone": as_text(r.get("phone"), 30),
            "website": as_text(r.get("website"), 255),
            "address": as_text(r.get("address")),
            "city": as_text(r.get("city"), 100),
            "state": as_text(r.get("state"), 100),
            "postal_code": as_text(r.get("postal_code"), 20),
            "country": as_text(r.get("country"), 100),
            "tax_id": as_text(r.get("tax_id"), 60),
            "registration_number": as_text(r.get("registration_number"), 60),
            "company_type": as_text(r.get("company_type"), 60),
            "products_services": as_text(r.get("products_services")),
            "notes": as_text(r.get("notes")),
        }
        year = as_decimal(r.get("year_established"), "year_established")
        if year is not None:
            fields["year_established"] = int(year)

        if existing:
            for key, value in fields.items():
                if value is not None:
                    setattr(existing, key, value)
            if risk:
                existing.risk_level = risk
            if not _blank(r.get("status")) and status_value != existing.status:
                self._approval(existing, "Imported status change", existing.status, status_value)
                existing.status = status_value
            self.touched_vendors.add(existing.id)
            self._remember_vendor(existing)
            return "updated"

        vendor = Vendor(
            vendor_code=code or next_vendor_code(self.db),
            status=status_value,
            risk_level=risk or "Medium",
            application_source="Spreadsheet Import",
            created_by=self.user.id,
            **{k: v for k, v in fields.items() if v is not None},
        )
        if status_value == VendorStatus.APPROVED:
            vendor.approved_by = self.user.id
            vendor.approved_at = datetime.now(timezone.utc)
            vendor.onboarded_on = self.today

        self.db.add(vendor)
        self.db.flush()
        self._approval(vendor, "Imported", None, status_value)
        self._remember_vendor(vendor)
        self.touched_vendors.add(vendor.id)
        return "created"

    def _approval(self, vendor: Vendor, action: str, previous: Optional[str], new: str) -> None:
        self.db.add(VendorApproval(
            vendor_id=vendor.id,
            action=action,
            previous_status=previous,
            new_status=new,
            performed_by=self.user.id,
            comments=f"Imported from {self.report.file_name}",
        ))

    # ---- certifications -------------------------------------------------------
    def import_certifications(self, r: dict) -> str:
        vendor = self.vendor(r.get("vendor"))
        name = as_text(r.get("certification_name"), 150)
        if not name:
            raise RowError("certification_name is required")
        number = as_text(r.get("certificate_number"), 80)
        expiry = as_date(r.get("expiry_date"), "expiry_date")

        existing = (
            self.db.query(VendorCertification)
            .filter(VendorCertification.vendor_id == vendor.id, VendorCertification.certification_name == name)
            .filter(VendorCertification.certificate_number == number if number else VendorCertification.id.isnot(None))
            .first()
        )

        target = existing or VendorCertification(vendor_id=vendor.id, certification_name=name)
        target.issuing_authority = as_text(r.get("issuing_authority"), 150) or target.issuing_authority
        target.certificate_number = number or target.certificate_number
        target.issue_date = as_date(r.get("issue_date"), "issue_date") or target.issue_date
        target.expiry_date = expiry or target.expiry_date
        target.status = "Expired" if target.expiry_date and target.expiry_date < self.today else "Valid"

        if not existing:
            self.db.add(target)
        self.touched_vendors.add(vendor.id)
        return "updated" if existing else "created"

    # ---- procurement requests --------------------------------------------------
    def import_procurement_requests(self, r: dict) -> str:
        number = as_text(r.get("request_number"), 50)
        existing = self.request(number) if number else None

        item = as_text(r.get("item"), 150)
        quantity = as_decimal(r.get("quantity"), "quantity")
        if not item:
            raise RowError("item is required")
        if quantity is None or quantity <= 0:
            raise RowError("quantity must be greater than zero")

        status_value = pick(ProcurementStatus.ALL, r.get("status"), "request status", ProcurementStatus.PENDING)
        vendor = self.vendor(r.get("vendor")) if not _blank(r.get("vendor")) else None
        category = as_category(r.get("category")) if not _blank(r.get("category")) else (vendor.category if vendor else None)

        target = existing or ProcurementRequest(request_number=number or next_request_number(self.db), requested_by=self.user.id)
        target.item = item
        target.description = as_text(r.get("description")) or target.description
        target.category = category
        target.quantity = quantity
        target.unit = as_text(r.get("unit"), 30) or target.unit or "Units"
        target.estimated_cost = as_decimal(r.get("estimated_cost"), "estimated_cost") or target.estimated_cost or Decimal("0")
        target.currency = as_text(r.get("currency"), 10) or target.currency or "USD"
        target.required_date = as_date(r.get("required_date"), "required_date") or target.required_date
        target.priority = pick(["Low", "Medium", "High", "Critical"], r.get("priority"), "priority", target.priority or "Medium")
        target.department = as_text(r.get("department"), 100) or target.department
        target.justification = as_text(r.get("justification")) or target.justification
        target.status = status_value
        if vendor:
            target.assigned_vendor_id = vendor.id
        if status_value not in (ProcurementStatus.PENDING, ProcurementStatus.REJECTED) and not target.approved_by:
            target.approved_by = self.user.id
            target.approved_at = datetime.now(timezone.utc)

        if not existing:
            self.db.add(target)
            self.db.flush()
            self._request_by_number[target.request_number] = target
        return "updated" if existing else "created"

    # ---- purchase orders (one PO per number, one line per row) --------------
    def _run_grouped_orders(self, sheet: str, records: list[tuple[int, dict]], result: SheetResult) -> None:
        groups: dict[str, list[tuple[int, dict]]] = {}
        for row_number, record in records:
            key = as_text(record.get("po_number")) or f"__row{row_number}"
            groups.setdefault(key, []).append((row_number, record))

        for key, rows in groups.items():
            savepoint = self.db.begin_nested()
            try:
                outcome = self.import_purchase_orders(key if not key.startswith("__row") else None, rows)
                self.db.flush()
                savepoint.commit()
                if outcome == "updated":
                    result.updated += len(rows)
                else:
                    result.created += len(rows)
            except Exception as exc:  # noqa: BLE001
                savepoint.rollback()
                result.skipped += len(rows)
                self.report.error(sheet, rows[0][0], self._message(exc) + (f" (PO {key})" if not key.startswith("__row") else ""))

    def import_purchase_orders(self, number: Optional[str], rows: list[tuple[int, dict]]) -> str:
        first = rows[0][1]
        vendor = self.vendor(first.get("vendor"))
        existing = self.purchase_order(number) if number else None

        order_date = as_date(first.get("order_date"), "order_date")
        expected = as_date(first.get("expected_delivery"), "expected_delivery")
        actual = as_date(first.get("actual_delivery"), "actual_delivery")

        if actual and order_date and actual < order_date:
            raise RowError("actual_delivery is earlier than order_date")

        if _blank(first.get("status")):
            status_value = PurchaseOrderStatus.COMPLETED if actual else (existing.status if existing else PurchaseOrderStatus.ORDERED)
        else:
            status_value = pick(PurchaseOrderStatus.ALL, first.get("status"), "purchase order status")

        if status_value in (PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED) and not actual and not (existing and existing.actual_delivery):
            actual = expected or order_date or self.today

        if existing:
            existing.status = status_value
            existing.expected_delivery = expected or existing.expected_delivery
            existing.actual_delivery = actual or existing.actual_delivery
            existing.payment_terms = as_text(first.get("payment_terms"), 100) or existing.payment_terms
            self.touched_vendors.add(existing.vendor_id)
            self._performance_for(existing, first)
            return "updated"

        if vendor.status != VendorStatus.APPROVED:
            raise RowError(
                f"vendor '{vendor.vendor_name}' is {vendor.status}; purchase orders can only be raised against approved vendors"
            )

        request = self.request(first.get("request_number"))

        po = PurchaseOrder(
            po_number=number or next_po_number(self.db),
            vendor_id=vendor.id,
            procurement_request_id=request.id if request else None,
            created_by=self.user.id,
            title=as_text(first.get("title"), 200) or as_text(first.get("item_name"), 200),
            department=as_text(first.get("department"), 100),
            order_date=order_date or self.today,
            expected_delivery=expected,
            actual_delivery=actual,
            currency=as_text(first.get("currency"), 10) or "USD",
            payment_terms=as_text(first.get("payment_terms"), 100),
            shipping_address=as_text(first.get("shipping_address")),
            billing_address=as_text(first.get("billing_address")),
            notes=as_text(first.get("notes")),
            status=status_value,
            source_ref=f"import:{self.report.file_name}"[:60],
        )
        if status_value not in (PurchaseOrderStatus.PENDING, PurchaseOrderStatus.CANCELLED):
            po.approved_by = self.user.id
            po.approved_at = datetime.now(timezone.utc)

        self.db.add(po)
        self.db.flush()

        subtotal = Decimal("0")
        tax = Decimal("0")
        for row_number, record in rows:
            item_name = as_text(record.get("item_name"), 200) or po.title or "Line item"
            quantity = as_decimal(record.get("quantity"), "quantity") or Decimal("1")
            unit_price = as_decimal(record.get("unit_price"), "unit_price")
            line_total = as_decimal(record.get("line_total"), "line_total")
            if unit_price is None:
                if line_total is None:
                    raise RowError(f"row {row_number}: give a unit_price or a line_total")
                unit_price = (line_total / quantity).quantize(Decimal("0.01"))
            if quantity <= 0 or unit_price < 0:
                raise RowError(f"row {row_number}: quantity must be positive and unit_price non-negative")
            rate = as_decimal(record.get("tax_rate"), "tax_rate") or Decimal("0")
            if rate < 1 and rate > 0:
                rate = rate * 100  # 0.18 -> 18%

            line = quantity * unit_price
            subtotal += line
            tax += line * rate / Decimal("100")
            self.db.add(PurchaseOrderItem(
                purchase_order_id=po.id,
                item_name=item_name,
                quantity=quantity,
                unit=as_text(record.get("unit"), 30) or "Units",
                unit_price=unit_price,
                tax_rate=rate,
                line_total=line,
            ))

        po.subtotal = subtotal
        po.tax_amount = tax.quantize(Decimal("0.01"))
        po.total_amount = (subtotal + tax).quantize(Decimal("0.01"))

        if request and request.status in (ProcurementStatus.APPROVED, ProcurementStatus.PENDING):
            request.status = ProcurementStatus.ORDERED
            request.assigned_vendor_id = request.assigned_vendor_id or vendor.id

        self._po_by_number[po.po_number] = po
        self.touched_vendors.add(vendor.id)
        self._performance_for(po, first)
        return "created"

    def _performance_for(self, po: PurchaseOrder, record: dict) -> None:
        """Delivered orders produce a performance evaluation, like the ETL."""

        if not po.actual_delivery or po.status not in (PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED):
            return

        if self.db.query(VendorPerformance.id).filter(VendorPerformance.purchase_order_id == po.id).first():
            return

        on_time = not po.expected_delivery or po.actual_delivery <= po.expected_delivery + timedelta(days=settings.DELIVERY_GRACE_DAYS)
        quality = as_decimal(record.get("quality_rating"), "quality_rating")
        if quality is not None and not (Decimal("0") <= quality <= Decimal("5")):
            raise RowError("quality_rating must be between 0 and 5")

        self.db.add(VendorPerformance(
            vendor_id=po.vendor_id,
            purchase_order_id=po.id,
            evaluation_date=po.actual_delivery,
            on_time_delivery=Decimal("100") if on_time else Decimal("0"),
            delayed_delivery=Decimal("0") if on_time else Decimal("100"),
            quality_rating=quality,
            order_completion_rate=Decimal("100") if po.status == PurchaseOrderStatus.COMPLETED else Decimal("85"),
            remarks=f"Imported from {self.report.file_name}",
        ))

    # ---- invoices ---------------------------------------------------------------
    def import_invoices(self, r: dict) -> str:
        po = self.purchase_order(r.get("po_number"))
        if not _blank(r.get("po_number")) and po is None:
            raise RowError(f"purchase order '{as_text(r.get('po_number'))}' was not found")
        vendor = self.db.get(Vendor, po.vendor_id) if po else self.vendor(r.get("vendor"))

        number = as_text(r.get("invoice_number"), 50)
        existing = self.db.query(Invoice).filter(Invoice.invoice_number == number).first() if number else None

        amount = as_decimal(r.get("amount"), "amount")
        if amount is None or amount < 0:
            raise RowError("amount is required and cannot be negative")
        tax = as_decimal(r.get("tax_amount"), "tax_amount") or Decimal("0")
        total = as_decimal(r.get("total_amount"), "total_amount") or (amount + tax)

        target = existing or Invoice(invoice_number=number or next_invoice_number(self.db), vendor_id=vendor.id)
        target.purchase_order_id = po.id if po else target.purchase_order_id
        target.vendor_id = vendor.id
        target.invoice_date = as_date(r.get("invoice_date"), "invoice_date") or target.invoice_date or self.today
        target.due_date = as_date(r.get("due_date"), "due_date") or target.due_date
        target.amount = amount
        target.tax_amount = tax
        target.total_amount = total
        target.currency = as_text(r.get("currency"), 10) or (po.currency if po else "USD")
        target.status = pick(InvoiceStatus.ALL, r.get("status"), "invoice status", target.status or InvoiceStatus.PENDING)
        target.payment_date = as_date(r.get("payment_date"), "payment_date") or target.payment_date
        if target.status == InvoiceStatus.PAID and not target.payment_date:
            target.payment_date = target.invoice_date
        target.notes = as_text(r.get("notes")) or target.notes

        if not existing:
            self.db.add(target)
        self.touched_vendors.add(vendor.id)
        return "updated" if existing else "created"

    # ---- contracts ----------------------------------------------------------------
    def import_contracts(self, r: dict) -> str:
        vendor = self.vendor(r.get("vendor"))
        start = as_date(r.get("start_date"), "start_date")
        expiry = as_date(r.get("expiry_date"), "expiry_date")
        if not start or not expiry:
            raise RowError("start_date and expiry_date are required")
        if expiry < start:
            raise RowError("expiry_date is before start_date")

        number = as_text(r.get("contract_number"), 50)
        existing = self.db.query(Contract).filter(Contract.contract_number == number).first() if number else None

        notice = as_decimal(r.get("renewal_notice_days"), "renewal_notice_days")
        notice_days = int(notice) if notice is not None else (existing.renewal_notice_days if existing else 30)

        if _blank(r.get("status")):
            if expiry < self.today:
                status_value = ContractStatus.EXPIRED
            elif expiry <= self.today + timedelta(days=notice_days):
                status_value = ContractStatus.EXPIRING
            else:
                status_value = ContractStatus.ACTIVE
        else:
            status_value = pick(ContractStatus.ALL, r.get("status"), "contract status")

        target = existing or Contract(contract_number=number or next_contract_number(self.db), vendor_id=vendor.id)
        target.vendor_id = vendor.id
        target.title = as_text(r.get("title"), 200) or target.title or f"{vendor.vendor_name} agreement"
        target.contract_type = as_text(r.get("contract_type"), 80) or target.contract_type or "Supply Agreement"
        target.start_date = start
        target.expiry_date = expiry
        target.contract_value = as_decimal(r.get("contract_value"), "contract_value") or target.contract_value
        target.currency = as_text(r.get("currency"), 10) or target.currency or "USD"
        target.status = status_value
        target.compliance_status = pick(
            ["Compliant", "Pending", "Non-Compliant", "Under Review"], r.get("compliance_status"),
            "compliance status", target.compliance_status or "Pending",
        )
        target.auto_renew = as_bool(r.get("auto_renew")) if not _blank(r.get("auto_renew")) else bool(target.auto_renew)
        target.renewal_notice_days = notice_days
        target.terms = as_text(r.get("terms")) or target.terms
        target.owner_id = target.owner_id or self.user.id

        if not existing:
            self.db.add(target)
        self.touched_vendors.add(vendor.id)
        return "updated" if existing else "created"

    # ---- standalone performance evaluations -----------------------------------------
    def import_performance(self, r: dict) -> str:
        vendor = self.vendor(r.get("vendor"))
        quality = as_decimal(r.get("quality_rating"), "quality_rating")
        if quality is None or not (Decimal("0") <= quality <= Decimal("5")):
            raise RowError("quality_rating must be between 0 and 5")
        service = as_decimal(r.get("service_rating"), "service_rating")
        if service is not None and not (Decimal("0") <= service <= Decimal("5")):
            raise RowError("service_rating must be between 0 and 5")
        po = self.purchase_order(r.get("po_number"))

        self.db.add(VendorPerformance(
            vendor_id=vendor.id,
            purchase_order_id=po.id if po else None,
            evaluation_date=as_date(r.get("evaluation_date"), "evaluation_date") or self.today,
            quality_rating=quality,
            service_rating=service,
            response_time=as_decimal(r.get("response_time"), "response_time"),
            issue_resolution_time=as_decimal(r.get("issue_resolution_time"), "issue_resolution_time"),
            remarks=as_text(r.get("remarks")) or f"Imported from {self.report.file_name}",
        ))
        self.touched_vendors.add(vendor.id)
        return "created"


def run_workbook(db: Session, user: User, frames: dict[str, pd.DataFrame], report: ImportReport) -> Importer:
    importer = Importer(db, user, report)

    planned: list[tuple[str, str, pd.DataFrame]] = []
    for sheet, frame in frames.items():
        if frame is None or frame.dropna(how="all").empty:
            continue
        entity = detect_entity(sheet, [str(c) for c in frame.columns])
        if entity is None:
            if norm(sheet) not in ("instructions", "readme", "read_me", "lists", "lookups"):
                report.unrecognised_sheets.append(sheet)
            continue
        planned.append((entity, sheet, frame))

    planned.sort(key=lambda p: ENTITY_ORDER.index(p[0]))

    for entity, sheet, frame in planned:
        report.sheets.append(importer.run_sheet(entity, sheet, frame))

    if not planned:
        report.notes.append(
            "No sheet could be matched to vendors, purchase orders, contracts, invoices, certifications, "
            "requests or performance. Download the template to see the expected layout."
        )

    return importer
