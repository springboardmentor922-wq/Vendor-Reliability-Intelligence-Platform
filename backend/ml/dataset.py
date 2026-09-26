"""Shared DataCo dataset handling for the predictive layer.

Both the model trainer (``ml/train_delay_model.py``) and the historical
loader (``etl/load_dataco.py``) read the dataset through this module so the
two always agree on how a raw supply-chain row becomes a purchase order.

--------------------------------------------------------------------------
How the dataset maps onto the platform
--------------------------------------------------------------------------
The DataCo Smart Supply Chain dataset is a transactional order log: one row
per order line, carrying the committed shipment time, the realised shipment
time, the lane (shipping mode / market / region), the commodity and the
commercial value.  It has no supplier column, so the loader derives one.

  slip            (real shipping days) - (scheduled shipping days)
  TOLERANCE_DAYS  the delivery tolerance folded into the committed date
  late            slip > TOLERANCE_DAYS

``slip`` is the only lateness signal in the source data.  Everything the
platform reports about delivery performance is derived from it, so the
figures on the dashboards trace back to real recorded outcomes rather than
to random numbers.

The dataset's own tolerance is folded into the committed delivery date: a
purchase order's ``expected_delivery`` is set so that a slip of one day or
less still lands on or before the committed date.  That keeps the
application's rule - "on time means delivered by the committed date" - true
without restating the threshold in two places.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

#: Slip up to and including this many days still counts as delivered on time.
TOLERANCE_DAYS = 1

#: A slip day translates into this many calendar days on a procurement lane.
#: Retail parcel shipping moves in single days; industrial freight slips in
#: multi-day increments, so the source slip is scaled up when it is written
#: onto a purchase order.
SLIP_SCALE = 2

#: The six procurement categories the platform recognises.
PROCUREMENT_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment Vendors",
    "IT Vendors",
    "Service Providers",
    "Logistics Partners",
    "Maintenance Vendors",
]

#: Curated commodity mappings. Anything not named here is distributed across
#: the six categories by descending row volume (see :func:`build_category_map`).
CATEGORY_OVERRIDES = {
    "Computers": "IT Vendors",
    "Electronics": "IT Vendors",
    "Consumer Electronics": "IT Vendors",
    "Video Games": "IT Vendors",
    "Cameras ": "IT Vendors",
    "DVDs": "IT Vendors",
    "CDs ": "IT Vendors",
    "Music": "IT Vendors",
    "Cardio Equipment": "Equipment Vendors",
    "Strength Training": "Equipment Vendors",
    "Fitness Accessories": "Equipment Vendors",
    "Golf Clubs": "Equipment Vendors",
    "Trade-In Items": "Maintenance Vendors",
    "Sporting Goods": "Equipment Vendors",
    "Health and Beauty ": "Service Providers",
    "Pet Supplies": "Service Providers",
    "Books ": "Service Providers",
}

#: Source columns kept from the CSV. Reading only these keeps the 180k-row
#: load fast and avoids pulling in the masked customer PII columns.
SOURCE_COLUMNS = [
    "Type",
    "Days for shipping (real)",
    "Days for shipment (scheduled)",
    "Delivery Status",
    "Late_delivery_risk",
    "Category Name",
    "Customer Segment",
    "Department Name",
    "Market",
    "Order Region",
    "Order Country",
    "order date (DateOrders)",
    "Order Id",
    "Order Item Discount Rate",
    "Order Item Product Price",
    "Order Item Profit Ratio",
    "Order Item Quantity",
    "Order Status",
    "Product Name",
    "Sales",
    "Order Item Total",
    "Shipping Mode",
]

#: Features the delivery-delay classifier is trained on. Every one of these
#: is knowable when the purchase order is raised - nothing derived from the
#: realised shipment is included, otherwise the model would simply be reading
#: the answer back out of the label.
CATEGORICAL_FEATURES = [
    "shipping_mode",
    "market",
    "order_region",
    "procurement_category",
    "customer_segment",
    "payment_type",
]

NUMERIC_FEATURES = [
    "scheduled_days",
    "quantity",
    "order_value",
    "unit_price",
    "discount_rate",
    "order_month",
    "order_quarter",
    "order_weekday",
    "vendor_prior_late_rate",
    "vendor_prior_orders",
]

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERIC_FEATURES

#: Columns that must never reach the model - they encode the outcome.
LEAKY_COLUMNS = [
    "Days for shipping (real)",
    "Delivery Status",
    "Late_delivery_risk",
    "slip",
    "late",
]


# --------------------------------------------------------------------------
# Vendor roster
# --------------------------------------------------------------------------

@dataclass
class VendorProfile:
    """A supplier the historical loader will create.

    ``mode_affinity`` is what makes suppliers genuinely different from one
    another.  It is the supplier's service mix - the share of its business
    carried on each shipping lane.  Because the source data has a very
    different realised-slip profile per lane, a supplier that runs mostly on
    lanes with poor punctuality ends up with a genuinely poor on-time record.
    A vendor's risk level is therefore explainable from its own lane mix
    rather than injected as noise.
    """

    name: str
    category: str
    contact: str
    email: str
    city: str
    country: str
    #: relative share of Standard / Second / First / Same Day lanes
    mode_affinity: dict = field(default_factory=dict)


#: Archetype lane mixes. Blended with the dataset's global mix at assignment
#: time so no supplier ends up on a single lane.
_ARCHETYPES = {
    # Bulk freight: long committed lead times, generally dependable.
    "bulk": {"Standard Class": 0.72, "Second Class": 0.10,
             "First Class": 0.12, "Same Day": 0.06},
    # Express: short lanes that the source data shows are met reliably.
    "express": {"Standard Class": 0.22, "Second Class": 0.06,
                "First Class": 0.50, "Same Day": 0.22},
    # Mixed: close to the market average.
    "mixed": {"Standard Class": 0.55, "Second Class": 0.22,
              "First Class": 0.16, "Same Day": 0.07},
    # Strained: leans on the lane with the worst realised punctuality.
    "strained": {"Standard Class": 0.28, "Second Class": 0.58,
                 "First Class": 0.10, "Same Day": 0.04},
    # Deteriorating: heavily weighted to the poor lane.
    "poor": {"Standard Class": 0.20, "Second Class": 0.70,
             "First Class": 0.07, "Same Day": 0.03},
}


def _vendor(name, category, archetype, contact, email, city, country):
    return VendorProfile(
        name=name,
        category=category,
        contact=contact,
        email=email,
        city=city,
        country=country,
        mode_affinity=_ARCHETYPES[archetype],
    )


#: The supplier roster the historical loader creates. Twenty-four suppliers
#: spread across all six procurement categories, with a deliberate mix of
#: strong, average and struggling performers so the reliability engine,
#: ranking and risk bands all have something real to separate.
VENDOR_ROSTER: list[VendorProfile] = [
    # ---- Raw Material Suppliers ------------------------------------
    _vendor("Northwind Steel Works", "Raw Material Suppliers", "bulk",
            "Jonas Lindqvist", "orders@northwindsteel.com",
            "Gothenburg", "Sweden"),
    _vendor("Cobalt Polymer Supply", "Raw Material Suppliers", "mixed",
            "Tomas Weber", "supply@cobaltpoly.de", "Munich", "Germany"),
    _vendor("Ardent Alloys Ltd", "Raw Material Suppliers", "bulk",
            "Fiona Cheng", "sales@ardentalloys.com", "Sheffield",
            "United Kingdom"),
    _vendor("Solvex Chemicals", "Raw Material Suppliers", "strained",
            "Rafael Ortiz", "orders@solvexchem.mx", "Monterrey", "Mexico"),
    _vendor("Terra Composites", "Raw Material Suppliers", "mixed",
            "Anke Visser", "supply@terracomposites.nl", "Rotterdam",
            "Netherlands"),

    # ---- Equipment Vendors -----------------------------------------
    _vendor("Meridian Precision Tools", "Equipment Vendors", "express",
            "Clara Beaumont", "sales@meridiantools.com", "Lyon", "France"),
    _vendor("Summit Industrial Rentals", "Equipment Vendors", "poor",
            "Owen Mbeki", "hire@summitrentals.co.za", "Durban",
            "South Africa"),
    _vendor("Kessler Machine Works", "Equipment Vendors", "bulk",
            "Lena Kessler", "orders@kesslermachine.de", "Stuttgart",
            "Germany"),
    _vendor("Pinnacle Automation", "Equipment Vendors", "mixed",
            "Hiroshi Tanaka", "sales@pinnacleauto.jp", "Nagoya", "Japan"),

    # ---- IT Vendors -------------------------------------------------
    _vendor("Arclight Systems", "IT Vendors", "express",
            "Devon Park", "accounts@arclightsys.com", "San Jose",
            "United States"),
    _vendor("Quantum Cloud Networks", "IT Vendors", "express",
            "Ito Nakamura", "biz@quantumcloud.jp", "Osaka", "Japan"),
    _vendor("Helix Data Systems", "IT Vendors", "mixed",
            "Priyanka Rao", "sales@helixdata.in", "Bengaluru", "India"),
    _vendor("Nimbus Software Group", "IT Vendors", "express",
            "Erik Sandberg", "contracts@nimbussg.se", "Stockholm", "Sweden"),

    # ---- Service Providers ------------------------------------------
    _vendor("Vantage Facility Services", "Service Providers", "mixed",
            "Mark Ellery", "hello@vantagefs.com", "Manchester",
            "United Kingdom"),
    _vendor("Clearline Consulting", "Service Providers", "express",
            "Aisha Rahman", "engage@clearlinecg.com", "Dubai",
            "United Arab Emirates"),
    _vendor("Beacon Testing Labs", "Service Providers", "mixed",
            "Paulo Ferreira", "labs@beacontesting.br", "Sao Paulo",
            "Brazil"),
    _vendor("Orchid Staffing Solutions", "Service Providers", "strained",
            "Nadia Hassan", "hire@orchidstaffing.eg", "Cairo", "Egypt"),

    # ---- Logistics Partners -----------------------------------------
    _vendor("Kestrel Logistics Group", "Logistics Partners", "mixed",
            "Ana Sousa", "dispatch@kestrellog.com", "Lisbon", "Portugal"),
    _vendor("Halcyon Freight Partners", "Logistics Partners", "strained",
            "Grace Adeyemi", "ops@halcyonfreight.com", "Lagos", "Nigeria"),
    _vendor("Trident Shipping Lines", "Logistics Partners", "bulk",
            "Marcus Holt", "bookings@tridentship.com", "Singapore",
            "Singapore"),
    _vendor("Vector Courier Network", "Logistics Partners", "express",
            "Elena Petrova", "support@vectorcourier.com", "Warsaw",
            "Poland"),

    # ---- Maintenance Vendors ----------------------------------------
    _vendor("Ironclad Maintenance Co.", "Maintenance Vendors", "poor",
            "Priya Nair", "service@ironcladmc.com", "Pune", "India"),
    _vendor("Bluepeak Engineering", "Maintenance Vendors", "mixed",
            "Callum Wright", "service@bluepeakeng.au", "Perth", "Australia"),
    _vendor("Rotor Dynamics Service", "Maintenance Vendors", "bulk",
            "Sven Aaltonen", "service@rotordynamics.fi", "Tampere",
            "Finland"),
]


# --------------------------------------------------------------------------
# Loading & preparation
# --------------------------------------------------------------------------

def resolve_dataset_path(explicit: Optional[str] = None) -> str:
    """Find the DataCo CSV, checking the usual locations in turn."""

    candidates = []

    if explicit:
        candidates.append(explicit)

    env_path = os.getenv("DATASET_PATH")
    if env_path:
        candidates.append(env_path)

    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    project = os.path.dirname(here)

    candidates.extend([
        os.path.join(project, "data", "DataCoSupplyChainDataset.csv"),
        os.path.join(here, "data", "DataCoSupplyChainDataset.csv"),
        os.path.join(
            os.path.expanduser("~"), "Downloads",
            "DataCoSupplyChainDataset.csv"
        ),
    ])

    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate

    raise FileNotFoundError(
        "Could not locate DataCoSupplyChainDataset.csv. Put it in the "
        "project's data/ folder or set DATASET_PATH. Looked in:\n  "
        + "\n  ".join(str(c) for c in candidates if c)
    )


def load_raw(path: Optional[str] = None, nrows: Optional[int] = None):
    """Read the DataCo CSV into a DataFrame with typed, tidy columns."""

    resolved = resolve_dataset_path(path)

    frame = pd.read_csv(
        resolved,
        encoding="latin-1",
        usecols=SOURCE_COLUMNS,
        nrows=nrows,
        low_memory=False,
    )

    # The source ships several column names with trailing whitespace.
    frame.columns = [c.strip() for c in frame.columns]

    return frame


def prepare(frame):
    """Clean the raw frame and derive the lateness signal.

    Returns a frame with tidy snake_case columns plus ``slip`` (days beyond
    the committed shipment time) and ``late`` (the model's target).
    """

    data = frame.copy()

    data = data.rename(columns={
        "Days for shipping (real)": "actual_days",
        "Days for shipment (scheduled)": "scheduled_days",
        "Delivery Status": "delivery_status",
        "Late_delivery_risk": "source_late_flag",
        "Category Name": "commodity",
        "Customer Segment": "customer_segment",
        "Department Name": "department",
        "Market": "market",
        "Order Region": "order_region",
        "Order Country": "order_country",
        "order date (DateOrders)": "order_date",
        "Order Id": "source_order_id",
        "Order Item Discount Rate": "discount_rate",
        "Order Item Product Price": "unit_price",
        "Order Item Profit Ratio": "profit_ratio",
        "Order Item Quantity": "quantity",
        "Order Status": "order_status",
        "Product Name": "product_name",
        "Sales": "sales",
        "Order Item Total": "order_value",
        "Shipping Mode": "shipping_mode",
        "Type": "payment_type",
    })

    data["order_date"] = pd.to_datetime(
        data["order_date"], format="%m/%d/%Y %H:%M", errors="coerce"
    )

    data = data.dropna(subset=["order_date", "scheduled_days", "actual_days"])

    for column in ("actual_days", "scheduled_days", "quantity"):
        data[column] = pd.to_numeric(data[column], errors="coerce")

    for column in ("unit_price", "order_value", "sales",
                   "discount_rate", "profit_ratio"):
        data[column] = pd.to_numeric(data[column], errors="coerce").fillna(0.0)

    data = data.dropna(subset=["actual_days", "scheduled_days", "quantity"])

    # ---- the lateness signal -----------------------------------
    data["slip"] = data["actual_days"] - data["scheduled_days"]
    data["late"] = (data["slip"] > TOLERANCE_DAYS).astype(int)

    # Calendar features, all knowable at order time.
    data["order_month"] = data["order_date"].dt.month
    data["order_quarter"] = data["order_date"].dt.quarter
    data["order_weekday"] = data["order_date"].dt.weekday

    for column in ("shipping_mode", "market", "order_region", "commodity",
                   "department", "customer_segment", "payment_type",
                   "order_status", "product_name", "order_country"):
        data[column] = data[column].astype(str).str.strip()

    return data.reset_index(drop=True)


def build_category_map(data) -> dict:
    """Map every DataCo commodity onto one of the six procurement categories.

    Curated names win; the rest are dealt round-robin across the six
    categories in descending volume order, which keeps each procurement
    category carrying a comparable share of the order book.
    """

    counts = data["commodity"].value_counts()
    mapping: dict[str, str] = {}
    cursor = 0

    for commodity in counts.index:
        override = CATEGORY_OVERRIDES.get(commodity)

        if override:
            mapping[commodity] = override
            continue

        mapping[commodity] = PROCUREMENT_CATEGORIES[
            cursor % len(PROCUREMENT_CATEGORIES)
        ]
        cursor += 1

    return mapping


def _stable_unit_interval(*parts) -> float:
    """Deterministic value in [0, 1) derived from the given parts.

    Used instead of a random draw so that re-running the loader assigns the
    same order to the same supplier every time.
    """

    digest = hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()

    return int(digest[:8], 16) / 0xFFFFFFFF


def assign_vendors(data, roster: Optional[list] = None, blend: float = 0.92):
    """Attach a supplier to every order row.

    Each order is offered to the suppliers in its procurement category and
    awarded to one of them in proportion to how strongly that supplier's lane
    mix favours the order's shipping mode.  ``blend`` controls how far a
    supplier's own archetype dominates: the affinity actually used is
    ``blend`` parts archetype and ``1 - blend`` parts the dataset's global
    lane mix, so no supplier is confined to a single lane.

    The choice is a deterministic function of the source order id, so the
    assignment is reproducible across runs.
    """

    roster = roster or VENDOR_ROSTER
    category_map = build_category_map(data)

    result = data.copy()
    result["procurement_category"] = result["commodity"].map(category_map)

    # Global lane mix, used to soften each supplier's archetype.
    global_mix = result["shipping_mode"].value_counts(normalize=True).to_dict()

    by_category: dict[str, list] = {}
    for index, profile in enumerate(roster):
        by_category.setdefault(profile.category, []).append((index, profile))

    # Pre-compute a weight per (category, shipping mode) so the row loop is a
    # cheap lookup rather than a dictionary rebuild per row.
    weight_table: dict[tuple, tuple] = {}

    for category, members in by_category.items():
        for mode, global_share in global_mix.items():
            weights = []

            for _, profile in members:
                archetype_share = profile.mode_affinity.get(mode, 0.0)
                weights.append(
                    blend * archetype_share + (1.0 - blend) * global_share
                )

            total = sum(weights) or 1.0
            cumulative = np.cumsum([w / total for w in weights])
            weight_table[(category, mode)] = (
                [m[0] for m in members], cumulative
            )

    indices = []

    categories = result["procurement_category"].to_numpy()
    modes = result["shipping_mode"].to_numpy()
    order_ids = result["source_order_id"].to_numpy()
    positions = np.arange(len(result))

    for row in range(len(result)):
        entry = weight_table.get((categories[row], modes[row]))

        if entry is None:
            indices.append(0)
            continue

        member_indices, cumulative = entry
        draw = _stable_unit_interval(order_ids[row], positions[row])
        slot = int(np.searchsorted(cumulative, draw))
        slot = min(slot, len(member_indices) - 1)
        indices.append(member_indices[slot])

    result["vendor_index"] = indices
    result["vendor_name"] = [roster[i].name for i in indices]

    return result


def add_vendor_history_features(data):
    """Add each supplier's track record *as it stood before that order*.

    This is the feature that makes the classifier a vendor-intelligence
    model rather than a lane lookup: it tells the model how the supplier has
    performed up to this point.  It is computed as an expanding mean shifted
    by one row within each supplier, so an order never contributes to its own
    feature value and no future information leaks backwards.
    """

    result = data.sort_values(["vendor_index", "order_date"]).copy()

    grouped = result.groupby("vendor_index", sort=False)["late"]

    prior_rate = grouped.transform(
        lambda s: s.shift(1).expanding().mean()
    )
    prior_count = grouped.transform(
        lambda s: s.shift(1).expanding().count()
    )

    # Before a supplier has any history the dataset-wide rate is the best
    # available estimate.
    baseline = float(result["late"].mean())

    result["vendor_prior_late_rate"] = prior_rate.fillna(baseline)
    result["vendor_prior_orders"] = prior_count.fillna(0)

    return result.sort_index()


def build_feature_frame(data):
    """Select and type the model's feature columns."""

    features = pd.DataFrame(index=data.index)

    for column in CATEGORICAL_FEATURES:
        features[column] = data[column].astype(str)

    for column in NUMERIC_FEATURES:
        features[column] = pd.to_numeric(
            data[column], errors="coerce"
        ).fillna(0.0)

    return features[FEATURE_COLUMNS]


def load_prepared(path: Optional[str] = None, nrows: Optional[int] = None):
    """Full pipeline: read the CSV, clean it, assign suppliers, add history."""

    frame = prepare(load_raw(path, nrows=nrows))
    frame = assign_vendors(frame)
    frame = add_vendor_history_features(frame)

    return frame
