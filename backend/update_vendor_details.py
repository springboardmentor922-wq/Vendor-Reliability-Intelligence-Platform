from pathlib import Path
import sys

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

# Make sure the backend directory is importable
BACKEND_DIR = Path(__file__).resolve().parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.database import engine, SessionLocal
from app.models.vendor import Vendor


# ============================================================
# SAMPLE VENDOR PROFILE DATA
# ============================================================

CONTACT_NAMES = [
    "Rahul Sharma",
    "Priya Reddy",
    "Arjun Kumar",
    "Sneha Rao",
    "Vikram Singh",
    "Ananya Mehta",
    "Karthik Rao",
    "Neha Verma",
    "Rohit Patel",
    "Divya Nair",
    "Sanjay Gupta",
    "Pooja Iyer",
    "Manoj Reddy",
    "Kavya Sharma",
    "Aditya Rao",
    "Meera Singh",
    "Nikhil Kumar",
    "Aishwarya Patel",
    "Suresh Nair",
    "Riya Gupta",
    "Harsha Verma",
    "Swathi Rao",
    "Varun Mehta",
    "Lakshmi Iyer",
    "Abhishek Sharma",
    "Deepika Reddy",
    "Gautam Singh",
    "Shreya Kumar",
    "Rakesh Patel",
    "Nandini Rao",
    "Ajay Nair",
    "Ishita Gupta",
    "Vivek Verma",
    "Madhuri Sharma",
    "Rohan Reddy",
    "Keerthi Singh",
    "Pranav Kumar",
    "Sakshi Patel",
    "Tarun Rao",
]


LOCATIONS = [
    "Hyderabad, Telangana",
    "Bengaluru, Karnataka",
    "Chennai, Tamil Nadu",
    "Pune, Maharashtra",
    "Mumbai, Maharashtra",
    "New Delhi, Delhi",
    "Ahmedabad, Gujarat",
    "Kolkata, West Bengal",
    "Noida, Uttar Pradesh",
    "Gurugram, Haryana",
    "Visakhapatnam, Andhra Pradesh",
    "Coimbatore, Tamil Nadu",
]


def make_email(vendor_id: int, name: str) -> str:

    safe_name = (
        name.lower()
        .replace(" ", ".")
        .replace("-", ".")
        .replace("&", "and")
    )

    return (
        f"{safe_name}.{vendor_id}"
        "@example.com"
    )


def make_phone(vendor_id: int) -> str:

    # Development/sample telephone numbers.
    return f"+91-90000-{vendor_id:05d}"


def make_contract(
    vendor_id: int,
    category: str,
) -> str:

    contract_type = {
        "Raw Material Suppliers":
            "Annual Raw Material Supply Agreement",
        "Equipment Vendors":
            "Equipment Supply & Maintenance Agreement",
        "IT Vendors":
            "IT Services & Support Agreement",
        "Service Providers":
            "Annual Service Agreement",
        "Logistics Partners":
            "Logistics & Transportation Agreement",
        "Maintenance Vendors":
            "Facility Maintenance Agreement",
    }.get(
        category,
        "Annual Vendor Agreement",
    )

    return (
        f"{contract_type} | "
        f"Contract No: VIQ-{vendor_id:03d} | "
        f"Term: 01-Apr-2026 to 31-Mar-2027 | "
        f"Renewal: Annual"
    )


def make_performance_score(
    vendor_id: int,
) -> float:

    # Deterministic sample development value.
    values = [
        82, 76, 71, 88, 69,
        91, 79, 73, 86, 77,
        84, 68, 93, 81, 74,
        89, 78, 72, 87, 80,
        75, 92, 83, 70, 85,
        90, 66, 77, 88, 73,
        82, 79, 94, 71, 86,
        76, 89, 81, 74,
    ]

    return float(
        values[
            (vendor_id - 1) % len(values)
        ]
    )


def make_reliability_score(
    performance_score: float,
    vendor_id: int,
) -> float:

    adjustments = [
        4, -2, 3, 5, -3,
        2, 0, 4, -1, 3,
    ]

    adjustment = adjustments[
        (vendor_id - 1)
        % len(adjustments)
    ]

    score = (
        performance_score
        + adjustment
    )

    return round(
        max(0.0, min(100.0, score)),
        2,
    )


def ensure_columns():

    inspector = inspect(engine)

    columns = {
        column["name"]
        for column in inspector.get_columns(
            "vendors"
        )
    }

    statements = []

    if "location" not in columns:

        statements.append(
            """
            ALTER TABLE vendors
            ADD COLUMN location VARCHAR(150)
            """
        )

    if "contract_details" not in columns:

        statements.append(
            """
            ALTER TABLE vendors
            ADD COLUMN contract_details VARCHAR(500)
            """
        )

    if "performance_score" not in columns:

        statements.append(
            """
            ALTER TABLE vendors
            ADD COLUMN performance_score NUMERIC(5,2)
            """
        )

    if "reliability_score" not in columns:

        statements.append(
            """
            ALTER TABLE vendors
            ADD COLUMN reliability_score NUMERIC(5,2)
            """
        )

    if not statements:

        print(
            "All required vendor columns already exist."
        )

        return

    with engine.begin() as connection:

        for statement in statements:

            print(
                "Executing:",
                statement.strip()
            )

            connection.execute(
                text(statement)
            )

    print(
        "Vendor columns added successfully."
    )


def update_vendors():

    db: Session = SessionLocal()

    try:

        vendors = (
            db.query(Vendor)
            .order_by(Vendor.id.asc())
            .all()
        )

        print(
            f"Found {len(vendors)} vendor records."
        )

        if len(vendors) < 39:

            print(
                "WARNING: Expected at least 39 vendors."
            )

        for index, vendor in enumerate(
            vendors
        ):

            vendor_id = vendor.id

            # ------------------------------------------------
            # Preserve the existing vendor information.
            # Only populate the additional fields when needed.
            # ------------------------------------------------

            if not vendor.contact_person:

                vendor.contact_person = (
                    CONTACT_NAMES[
                        index
                        % len(CONTACT_NAMES)
                    ]
                )

            if not vendor.email:

                vendor.email = make_email(
                    vendor_id,
                    vendor.name,
                )

            if not vendor.phone:

                vendor.phone = make_phone(
                    vendor_id
                )

            if not vendor.location:

                vendor.location = (
                    LOCATIONS[
                        index
                        % len(LOCATIONS)
                    ]
                )

            if not vendor.contract_details:

                vendor.contract_details = (
                    make_contract(
                        vendor_id,
                        vendor.category,
                    )
                )

            performance = (
                make_performance_score(
                    vendor_id
                )
            )

            reliability = (
                make_reliability_score(
                    performance,
                    vendor_id,
                )
            )

            # Populate the new fields.
            vendor.performance_score = (
                performance
            )

            vendor.reliability_score = (
                reliability
            )

            print(
                f"Updated Vendor "
                f"{vendor.id}: "
                f"{vendor.name}"
            )

        db.commit()

        print()
        print("=" * 65)
        print(
            "39-VENDOR PROFILE UPDATE COMPLETED"
        )
        print("=" * 65)
        print(
            "Existing vendor records were preserved."
        )
        print(
            "Additional profile fields populated."
        )
        print(
            "Performance and reliability values populated."
        )
        print("=" * 65)

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


if __name__ == "__main__":

    print("=" * 65)
    print(
        "VENDORIQ - COMPLETE VENDOR PROFILE UPDATE"
    )
    print("=" * 65)

    ensure_columns()

    update_vendors()