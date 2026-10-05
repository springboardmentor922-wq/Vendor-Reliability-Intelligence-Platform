from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.vendor import Vendor


NEW_VENDORS = [
    # Raw Material Suppliers
    {
        "name": "Apex Raw Materials",
        "category": "Raw Material Suppliers",
        "contact_person": "Arjun Rao",
        "email": "apex.rawmaterials@vendoriq.com",
        "phone": "+91 9876501001",
        "status": "Pending",
    },
    {
        "name": "Prime Industrial Materials",
        "category": "Raw Material Suppliers",
        "contact_person": "Meera Sharma",
        "email": "prime.materials@vendoriq.com",
        "phone": "+91 9876501002",
        "status": "Approved",
    },
    {
        "name": "Southern Raw Materials",
        "category": "Raw Material Suppliers",
        "contact_person": "Kiran Kumar",
        "email": "southern.rawmaterials@vendoriq.com",
        "phone": "+91 9876501003",
        "status": "Rejected",
    },

    # Equipment Vendors
    {
        "name": "Vertex Equipment Solutions",
        "category": "Equipment Vendors",
        "contact_person": "Rahul Verma",
        "email": "vertex.equipment@vendoriq.com",
        "phone": "+91 9876501004",
        "status": "Pending",
    },
    {
        "name": "Industrial Tech Equipment",
        "category": "Equipment Vendors",
        "contact_person": "Priya Nair",
        "email": "industrial.equipment@vendoriq.com",
        "phone": "+91 9876501005",
        "status": "Approved",
    },
    {
        "name": "Metro Equipment Systems",
        "category": "Equipment Vendors",
        "contact_person": "Vikram Singh",
        "email": "metro.equipment@vendoriq.com",
        "phone": "+91 9876501006",
        "status": "Rejected",
    },

    # IT Vendors
    {
        "name": "CloudCore Technologies",
        "category": "IT Vendors",
        "contact_person": "Ananya Reddy",
        "email": "cloudcore.it@vendoriq.com",
        "phone": "+91 9876501007",
        "status": "Pending",
    },
    {
        "name": "NextGen IT Services",
        "category": "IT Vendors",
        "contact_person": "Sandeep Kumar",
        "email": "nextgen.it@vendoriq.com",
        "phone": "+91 9876501008",
        "status": "Approved",
    },
    {
        "name": "DigitalEdge Solutions",
        "category": "IT Vendors",
        "contact_person": "Sneha Patel",
        "email": "digitaledge.it@vendoriq.com",
        "phone": "+91 9876501009",
        "status": "Rejected",
    },

    # Service Providers
    {
        "name": "Reliable Facility Services",
        "category": "Service Providers",
        "contact_person": "Manoj Das",
        "email": "reliable.services@vendoriq.com",
        "phone": "+91 9876501010",
        "status": "Pending",
    },
    {
        "name": "Elite Business Services",
        "category": "Service Providers",
        "contact_person": "Divya Menon",
        "email": "elite.services@vendoriq.com",
        "phone": "+91 9876501011",
        "status": "Approved",
    },
    {
        "name": "ProSupport Services",
        "category": "Service Providers",
        "contact_person": "Nikhil Joshi",
        "email": "prosupport.services@vendoriq.com",
        "phone": "+91 9876501012",
        "status": "Rejected",
    },

    # Logistics Partners
    {
        "name": "FastTrack Logistics",
        "category": "Logistics Partners",
        "contact_person": "Rohit Gupta",
        "email": "fasttrack.logistics@vendoriq.com",
        "phone": "+91 9876501013",
        "status": "Pending",
    },
    {
        "name": "National Freight Partners",
        "category": "Logistics Partners",
        "contact_person": "Lakshmi Iyer",
        "email": "national.freight@vendoriq.com",
        "phone": "+91 9876501014",
        "status": "Approved",
    },
    {
        "name": "ExpressMove Logistics",
        "category": "Logistics Partners",
        "contact_person": "Amit Shah",
        "email": "expressmove.logistics@vendoriq.com",
        "phone": "+91 9876501015",
        "status": "Rejected",
    },

    # Maintenance Vendors
    {
        "name": "Prime Maintenance Works",
        "category": "Maintenance Vendors",
        "contact_person": "Ramesh Babu",
        "email": "prime.maintenance@vendoriq.com",
        "phone": "+91 9876501016",
        "status": "Pending",
    },
    {
        "name": "TotalCare Maintenance",
        "category": "Maintenance Vendors",
        "contact_person": "Swathi Rao",
        "email": "totalcare.maintenance@vendoriq.com",
        "phone": "+91 9876501017",
        "status": "Approved",
    },
    {
        "name": "FacilityFix Solutions",
        "category": "Maintenance Vendors",
        "contact_person": "Harish Reddy",
        "email": "facilityfix@vendoriq.com",
        "phone": "+91 9876501018",
        "status": "Rejected",
    },
]


def setup_vendors():
    db: Session = SessionLocal()

    try:
        vendors = db.query(Vendor).all()

        # ---------------------------------------------------------
        # 1. Fix old .local email addresses
        # ---------------------------------------------------------
        email_fixed = 0

        for vendor in vendors:
            if vendor.email and vendor.email.endswith("@vendoriq.local"):
                vendor.email = vendor.email.replace(
                    "@vendoriq.local",
                    "@vendoriq.com",
                )
                email_fixed += 1

        # ---------------------------------------------------------
        # 2. Add new vendors without duplicates
        # ---------------------------------------------------------
        added = 0
        skipped = 0

        for data in NEW_VENDORS:
            existing = (
                db.query(Vendor)
                .filter(Vendor.email == data["email"])
                .first()
            )

            if existing:
                skipped += 1
                continue

            vendor = Vendor(
                name=data["name"],
                category=data["category"],
                contact_person=data["contact_person"],
                email=data["email"],
                phone=data["phone"],
                status=data["status"],
            )

            db.add(vendor)
            added += 1

        db.commit()

        # ---------------------------------------------------------
        # 3. Display final database information
        # ---------------------------------------------------------
        all_vendors = db.query(Vendor).all()

        pending = sum(
            1 for vendor in all_vendors
            if vendor.status == "Pending"
        )

        approved = sum(
            1 for vendor in all_vendors
            if vendor.status == "Approved"
        )

        rejected = sum(
            1 for vendor in all_vendors
            if vendor.status == "Rejected"
        )

        print()
        print("=" * 60)
        print("VENDOR DATA SETUP COMPLETED")
        print("=" * 60)
        print(f"Existing vendors found : {len(vendors)}")
        print(f"Emails fixed            : {email_fixed}")
        print(f"New vendors added       : {added}")
        print(f"Duplicates skipped      : {skipped}")
        print("-" * 60)
        print(f"Total vendors           : {len(all_vendors)}")
        print(f"Pending                 : {pending}")
        print(f"Approved                : {approved}")
        print(f"Rejected                : {rejected}")
        print("=" * 60)
        print()

    except Exception as error:
        db.rollback()
        print()
        print("ERROR:", error)
        print()

    finally:
        db.close()


if __name__ == "__main__":
    setup_vendors()