"""
scripts/import_dataco.py
------------------------
Idempotent import script for the DataCo Supply Chain Dataset.
This is the ONLY business dataset for VendorPulse.

Reads DataCoSupplyChainDataset.csv and upserts records into:
  - vendors        (from unique Department Name + Market combinations)
  - purchase_orders (from Order rows)
  - deliveries     (from Order/Delivery status)

Safe to re-run — uses upsert keyed on unique identifiers.

Usage:
    python scripts/import_dataco.py
"""

import sys
import os
from pathlib import Path

# ── Ensure project root is on sys.path ────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Dict, List, Optional

from database.connection import get_database
from config.settings import (
    COLLECTION_VENDORS,
    COLLECTION_PURCHASE_ORDERS,
    COLLECTION_DELIVERIES,
    DATACO_DATASET_PATH,
)

SOURCE_TAG = "dataco"

# ── Delivery status mapping ───────────────────────────────────────────────────
DELIVERY_STATUS_MAP = {
    "Advance shipping": "Delivered",
    "Late delivery": "Pending",
    "Shipping on time": "Delivered",
    "Shipping canceled": "Partially Delivered",
}

ORDER_STATUS_MAP = {
    "COMPLETE": "Delivered",
    "PENDING": "Pending",
    "PROCESSING": "Ordered",
    "PENDING_PAYMENT": "Pending",
    "CLOSED": "Completed",
    "CANCELED": "Cancelled",
    "ON_HOLD": "Pending",
    "PAYMENT_REVIEW": "Pending",
    "SUSPECTED_FRAUD": "Cancelled",
}

# ── DataCo Category → Vendor Category mapping ─────────────────────────────────
DEPT_TO_CATEGORY = {
    "Fitness": "Sporting Goods",
    "Outdoors": "Raw Materials",
    "Apparel": "Packaging",
    "Electronics": "Electronics",
    "Fan Shop": "Other",
    "Book Shop": "Office Supplies",
    "Health and Beauty": "Healthcare & Pharma",
    "Discs Shop": "Electronics",
    "Technology": "IT & Technology",
    "Footwear": "Manufacturing",
    "Pet Shop": "Other",
    "Golf": "Sporting Goods",
    "Toy Store": "Other",
    "Garden": "Other",
}


def _parse_date(val) -> Optional[datetime]:
    if pd.isna(val) or val is None or str(val).strip() == "":
        return None
    try:
        dt = pd.to_datetime(val, infer_datetime_format=True)
        return dt.to_pydatetime().replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _safe_float(val) -> Optional[float]:
    if pd.isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def import_vendors(db, df: pd.DataFrame) -> Dict[str, str]:
    """
    Create/update vendor records from unique Department + Market combinations.
    Returns a mapping: {(department, market): vendor_id_string}.
    """
    col = db[COLLECTION_VENDORS]
    vendor_map: Dict[str, str] = {}
    imported = 0
    updated = 0

    # Calculate per-vendor stats from DataCo data
    df["_dept_market"] = df["Department Name"] + " — " + df["Market"]

    # Group by department + market
    groups = df.groupby(["Department Name", "Market"])

    for (dept, market), group in groups:
        key = f"{dept}_{market}"
        vendor_name = f"{dept} — {market}"
        vendor_code = f"VND-{dept[:4].upper()}-{market[:3].upper()}"

        total_orders = len(group)
        late_count = (group["Late_delivery_risk"] == 1).sum() if "Late_delivery_risk" in group.columns else 0
        on_time_count = total_orders - late_count
        late_rate = round(late_count / total_orders, 4) if total_orders > 0 else 0.0

        avg_real_days = _safe_float(group["Days for shipping (real)"].mean()) if "Days for shipping (real)" in group.columns else None
        avg_sched_days = _safe_float(group["Days for shipment (scheduled)"].mean()) if "Days for shipment (scheduled)" in group.columns else None

        # Unique categories supplied
        categories_list = sorted(group["Category Name"].dropna().unique().tolist()) if "Category Name" in group.columns else []
        shipping_modes = sorted(group["Shipping Mode"].dropna().unique().tolist()) if "Shipping Mode" in group.columns else []

        # Determine vendor category
        category = DEPT_TO_CATEGORY.get(dept, "Other")

        # Reliability score from on-time rate (0-100)
        reliability = round((on_time_count / total_orders) * 100, 1) if total_orders > 0 else 50.0

        now = datetime.now(timezone.utc)
        vendor_doc = {
            "vendor_code": vendor_code,
            "company_name": vendor_name,
            "category": category,
            "department": dept,
            "market": market,
            "status": "Active",
            "approval_status": "Approved",
            "description": f"DataCo Supply Chain vendor — {dept} products in {market} market.",
            "payment_terms": "Net 30",
            "reliability_score": reliability,
            "source": SOURCE_TAG,
            "total_orders": int(total_orders),
            "late_delivery_count": int(late_count),
            "on_time_count": int(on_time_count),
            "late_delivery_rate": late_rate,
            "avg_shipping_days_real": round(avg_real_days, 2) if avg_real_days else None,
            "avg_shipping_days_scheduled": round(avg_sched_days, 2) if avg_sched_days else None,
            "categories_supplied": categories_list[:10],  # cap list length
            "shipping_modes": shipping_modes,
            "created_by": "system_import",
            "approved_by": "system_import",
            "updated_at": now,
        }

        result = col.update_one(
            {"vendor_code": vendor_code, "source": SOURCE_TAG},
            {
                "$set": vendor_doc,
                "$setOnInsert": {
                    "contact_information": {
                        "primary_contact_name": f"Operations Lead",
                        "primary_email": f"ops@{dept.lower().replace(' ', '')}-{market.lower().replace(' ', '')}.com",
                        "primary_phone": f"+1 (555) 000-0001",
                    },
                    "address": {
                        "city": market,
                        "country": market,
                    },
                    "created_at": now,
                },
            },
            upsert=True,
        )

        if result.upserted_id:
            vid = str(result.upserted_id)
            imported += 1
        else:
            existing = col.find_one({"vendor_code": vendor_code, "source": SOURCE_TAG})
            vid = str(existing["_id"]) if existing else ""
            updated += 1

        vendor_map[key] = vid

    print(f"  Vendors: {imported} imported, {updated} updated")
    return vendor_map


def import_purchase_orders(db, df: pd.DataFrame, vendor_map: Dict[str, str]) -> Dict[str, str]:
    """
    Import purchase orders from unique Order IDs.
    Returns a mapping: {order_id: po_id_string}.
    """
    col = db[COLLECTION_PURCHASE_ORDERS]
    po_map: Dict[str, str] = {}
    imported = 0
    skipped = 0
    invalid = 0

    # Group by Order Id (one PO per order)
    order_groups = df.groupby("Order Id")

    for order_id, group in order_groups:
        po_number = f"DC-PO-{int(order_id)}"
        first = group.iloc[0]

        dept = str(first.get("Department Name", "")).strip()
        market = str(first.get("Market", "")).strip()
        vendor_key = f"{dept}_{market}"
        vendor_id = vendor_map.get(vendor_key, "")

        if not vendor_id:
            invalid += 1
            continue

        order_date = _parse_date(first.get("order date (DateOrders)"))
        ship_date = _parse_date(first.get("shipping date (DateOrders)"))
        if order_date is None:
            invalid += 1
            continue

        order_status_raw = str(first.get("Order Status", "PENDING")).strip()
        status = ORDER_STATUS_MAP.get(order_status_raw, "Pending")

        # Build items from group rows
        items = []
        total_amount = 0.0
        for _, row in group.iterrows():
            product = str(row.get("Product Name", "")).strip()
            qty = _safe_float(row.get("Order Item Quantity")) or 1.0
            unit_price = _safe_float(row.get("Order Item Product Price")) or 0.0
            item_total = _safe_float(row.get("Order Item Total")) or (qty * unit_price)
            total_amount += item_total or 0.0
            items.append({
                "description": product,
                "quantity": qty,
                "unit_price": unit_price,
                "total_price": round(item_total, 2),
                "unit": "units",
            })

        # Primary product (first item)
        primary_product = items[0]["description"] if items else ""
        primary_category = str(first.get("Category Name", "")).strip()
        shipping_mode = str(first.get("Shipping Mode", "")).strip()
        delivery_risk = int(first.get("Late_delivery_risk", 0) or 0)
        benefit = _safe_float(first.get("Benefit per order"))

        actual_delivery = ship_date if status == "Delivered" else None

        po_doc = {
            "po_number": po_number,
            "vendor_id": vendor_id,
            "vendor_name": f"{dept} — {market}",
            "request_id": None,
            "procurement_request_number": None,
            "product_name": primary_product,
            "category": primary_category,
            "items": items,
            "quantity": sum(it["quantity"] for it in items),
            "unit_price": items[0]["unit_price"] if items else 0.0,
            "total_amount": round(total_amount, 2),
            "currency": "USD",
            "order_date": order_date,
            "expected_delivery_date": ship_date,
            "actual_delivery_date": actual_delivery,
            "status": status,
            "vendor_acceptance_status": "Accepted",
            "created_by": "system_import",
            "approved_by": None,
            "shipping_address": f"{str(first.get('Order City', ''))} {str(first.get('Order Country', ''))}".strip(),
            "payment_terms": str(first.get("Type", "Other")),
            "notes": f"Shipping: {shipping_mode}. Late delivery risk: {'Yes' if delivery_risk else 'No'}.",
            "defective_units": None,
            "compliance": True,
            "source": SOURCE_TAG,
            "benefit_per_order": benefit,
            "updated_at": datetime.now(timezone.utc),
        }

        result = col.update_one(
            {"po_number": po_number},
            {
                "$set": po_doc,
                "$setOnInsert": {"created_at": order_date or datetime.now(timezone.utc)},
            },
            upsert=True,
        )

        if result.upserted_id:
            po_id = str(result.upserted_id)
            imported += 1
        else:
            existing = col.find_one({"po_number": po_number})
            po_id = str(existing["_id"]) if existing else ""
            skipped += 1

        po_map[str(order_id)] = po_id

    print(f"  Purchase Orders: {imported} imported, {skipped} already existed, {invalid} invalid/skipped")
    return po_map


def import_deliveries(db, df: pd.DataFrame, vendor_map: Dict[str, str], po_map: Dict[str, str]) -> int:
    """Create delivery records from DataCo order status data."""
    col = db[COLLECTION_DELIVERIES]
    imported = 0
    skipped = 0
    excluded = 0

    for order_id, group in df.groupby("Order Id"):
        first = group.iloc[0]
        order_status_raw = str(first.get("Order Status", "PENDING")).strip()
        status = ORDER_STATUS_MAP.get(order_status_raw, "Pending")

        if status == "Cancelled":
            excluded += 1
            continue

        dept = str(first.get("Department Name", "")).strip()
        market = str(first.get("Market", "")).strip()
        vendor_key = f"{dept}_{market}"
        vendor_id = vendor_map.get(vendor_key, "")
        po_id = po_map.get(str(order_id), "")

        if not vendor_id or not po_id:
            excluded += 1
            continue

        ship_date = _parse_date(first.get("shipping date (DateOrders)"))
        order_date = _parse_date(first.get("order date (DateOrders)"))
        delivery_status_raw = str(first.get("Delivery Status", "")).strip()
        del_status = DELIVERY_STATUS_MAP.get(delivery_status_raw, "Pending")
        actual_date = ship_date if del_status == "Delivered" else None

        real_days = _safe_float(first.get("Days for shipping (real)"))
        sched_days = _safe_float(first.get("Days for shipment (scheduled)"))
        delay_days = 0
        if real_days is not None and sched_days is not None:
            delay_days = max(0, int(real_days - sched_days))

        delivery_number = f"DEL-DC-{int(order_id)}"
        delivery_doc = {
            "delivery_number": delivery_number,
            "po_id": po_id,
            "vendor_id": vendor_id,
            "expected_date": ship_date,
            "actual_date": actual_date,
            "status": del_status,
            "quality_rating": None,
            "delay_days": delay_days,
            "remarks": delivery_status_raw,
            "received_by": None,
            "tracking_number": None,
            "carrier": str(first.get("Shipping Mode", "")),
            "source": SOURCE_TAG,
        }

        result = col.update_one(
            {"delivery_number": delivery_number},
            {
                "$set": delivery_doc,
                "$setOnInsert": {"created_at": order_date or datetime.now(timezone.utc)},
            },
            upsert=True,
        )

        if result.upserted_id:
            imported += 1
        else:
            skipped += 1

    print(f"  Deliveries: {imported} imported, {skipped} already existed, {excluded} excluded")
    return imported


def main():
    print("=" * 65)
    print("  VendorPulse — DataCo Supply Chain Dataset Import")
    print("=" * 65)
    print()

    # 1. Read dataset
    csv_path = DATACO_DATASET_PATH
    if not csv_path.exists():
        # Try alternate filename variations
        alt_paths = [
            PROJECT_ROOT / "data" / "DataCoSupplyChainDataset.csv",
            PROJECT_ROOT / "data" / "DataCo Supply Chain Dataset.csv",
        ]
        for p in alt_paths:
            if p.exists():
                csv_path = p
                break
        else:
            print(f"ERROR: DataCo dataset not found.")
            print(f"Expected: {DATACO_DATASET_PATH}")
            sys.exit(1)

    print(f"[1/6] Reading dataset: {csv_path}")
    df = pd.read_csv(csv_path, encoding="latin1")
    print(f"       Records: {len(df):,}, Columns: {len(df.columns)}")
    print()

    # 2. Validate required columns
    print("[2/6] Validating dataset...")
    required_cols = [
        "Order Id", "Department Name", "Market", "Product Name",
        "Category Name", "Order Item Quantity", "Order Item Product Price",
        "Order Item Total", "Order Status", "Delivery Status",
        "order date (DateOrders)", "shipping date (DateOrders)",
        "Days for shipping (real)", "Days for shipment (scheduled)",
        "Late_delivery_risk",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        print(f"ERROR: Missing required columns: {missing}")
        sys.exit(1)
    print(f"       All required columns present.")

    # Drop rows with no Order Id
    before = len(df)
    df = df.dropna(subset=["Order Id"])
    df["Order Id"] = df["Order Id"].astype(int)
    print(f"       Valid rows: {len(df):,} (dropped {before - len(df)} with no Order ID)")
    print()

    # 3. Connect to database
    print("[3/6] Connecting to MongoDB...")
    db = get_database()
    print(f"       Database: {db.name}")
    print()

    # 4. Import vendors
    print("[4/6] Importing vendors (Department + Market combinations)...")
    vendor_map = import_vendors(db, df)
    print()

    # 5. Import purchase orders
    print("[5/6] Importing purchase orders...")
    po_map = import_purchase_orders(db, df, vendor_map)
    print()

    # 6. Import deliveries
    print("[6/6] Importing delivery records...")
    delivery_count = import_deliveries(db, df, vendor_map, po_map)
    print()

    # ── Summary ───────────────────────────────────────────────────────────────
    total_vendors = db[COLLECTION_VENDORS].count_documents({"source": SOURCE_TAG})
    total_pos = db[COLLECTION_PURCHASE_ORDERS].count_documents({"source": SOURCE_TAG})
    total_dels = db[COLLECTION_DELIVERIES].count_documents({"source": SOURCE_TAG})

    print("=" * 65)
    print("  IMPORT SUMMARY")
    print("=" * 65)
    print(f"  Dataset Rows:             {len(df):,}")
    print(f"  Vendors Imported:         {total_vendors}")
    print(f"  Purchase Orders Imported: {total_pos}")
    print(f"  Deliveries Imported:      {total_dels}")
    print("=" * 65)
    print()
    print("[OK] DataCo import complete!")


if __name__ == "__main__":
    main()
