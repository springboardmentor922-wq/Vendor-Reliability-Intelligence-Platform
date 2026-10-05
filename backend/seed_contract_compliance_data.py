from datetime import date

from app.database import SessionLocal
from app.models.vendor import Vendor
from app.models.contract import Certification, VendorDocument


def main():
    db = SessionLocal()

    try:
        print("=" * 60)
        print("CONTRACT & COMPLIANCE SAMPLE DATA")
        print("=" * 60)

        # ---------------------------------------------------------
        # SAMPLE CERTIFICATIONS
        # ---------------------------------------------------------

        certifications = [
            {
                "vendor_id": 1,
                "name": "ISO 9001 Quality Management",
                "certificate_number": "CERT-ABC-001",
                "issue_date": date(2026, 1, 10),
                "expiry_date": date(2027, 1, 9),
                "status": "Active",
            },
            {
                "vendor_id": 6,
                "name": "ISO 14001 Environmental Management",
                "certificate_number": "CERT-ABC4-002",
                "issue_date": date(2025, 7, 15),
                "expiry_date": date(2026, 7, 14),
                "status": "Expired",
            },
            {
                "vendor_id": 3,
                "name": "ISO 45001 Occupational Safety",
                "certificate_number": "CERT-ABCD-003",
                "issue_date": date(2026, 2, 20),
                "expiry_date": date(2027, 2, 19),
                "status": "Active",
            },
            {
                "vendor_id": 5,
                "name": "Information Security Certification",
                "certificate_number": "CERT-ABCDE-004",
                "issue_date": date(2026, 4, 1),
                "expiry_date": date(2027, 3, 31),
                "status": "Active",
            },
            {
                "vendor_id": 25,
                "name": "Supplier Quality Certification",
                "certificate_number": "CERT-APEX-005",
                "issue_date": date(2026, 5, 5),
                "expiry_date": date(2026, 10, 31),
                "status": "Pending",
            },
            {
                "vendor_id": 30,
                "name": "ISO 27001 Information Security",
                "certificate_number": "CERT-CLOUD-006",
                "issue_date": date(2026, 3, 12),
                "expiry_date": date(2027, 3, 11),
                "status": "Active",
            },
        ]

        certifications_added = 0
        certifications_skipped = 0

        for data in certifications:

            vendor = db.query(Vendor).filter(
                Vendor.id == data["vendor_id"]
            ).first()

            if not vendor:
                print(
                    f"Skipping certification "
                    f"{data['certificate_number']} - "
                    f"Vendor {data['vendor_id']} not found"
                )
                continue

            existing = db.query(Certification).filter(
                Certification.vendor_id == data["vendor_id"],
                Certification.certificate_number
                == data["certificate_number"]
            ).first()

            if existing:
                certifications_skipped += 1
                continue

            certification = Certification(
                vendor_id=data["vendor_id"],
                name=data["name"],
                certificate_number=data["certificate_number"],
                issue_date=data["issue_date"],
                expiry_date=data["expiry_date"],
                status=data["status"],
            )

            db.add(certification)
            certifications_added += 1

        # ---------------------------------------------------------
        # SAMPLE VENDOR DOCUMENTS
        # ---------------------------------------------------------

        documents = [
            {
                "vendor_id": 1,
                "document_type": "Registration / Tax / Insurance",
                "document_name": "Business Registration Certificate",
                "document_number": "DOC-ABC-001",
                "issue_date": date(2026, 1, 1),
                "expiry_date": date(2027, 1, 1),
                "status": "Active",
                "notes": "Vendor registration and business verification document.",
            },
            {
                "vendor_id": 6,
                "document_type": "Tax Document",
                "document_name": "GST Registration Certificate",
                "document_number": "DOC-ABC4-002",
                "issue_date": date(2025, 4, 1),
                "expiry_date": date(2026, 8, 31),
                "status": "Expired",
                "notes": "GST registration document requires renewal.",
            },
            {
                "vendor_id": 3,
                "document_type": "Insurance",
                "document_name": "Vendor Liability Insurance",
                "document_number": "DOC-ABCD-003",
                "issue_date": date(2026, 2, 1),
                "expiry_date": date(2027, 1, 31),
                "status": "Active",
                "notes": "Liability insurance documentation.",
            },
            {
                "vendor_id": 5,
                "document_type": "Compliance",
                "document_name": "Compliance Declaration",
                "document_number": "DOC-ABCDE-004",
                "issue_date": date(2026, 3, 15),
                "expiry_date": date(2027, 3, 14),
                "status": "Active",
                "notes": "Annual vendor compliance declaration.",
            },
            {
                "vendor_id": 25,
                "document_type": "Financial",
                "document_name": "Financial Verification Document",
                "document_number": "DOC-APEX-005",
                "issue_date": date(2026, 6, 1),
                "expiry_date": date(2026, 12, 31),
                "status": "Pending",
                "notes": "Financial verification awaiting final review.",
            },
            {
                "vendor_id": 30,
                "document_type": "Information Security",
                "document_name": "Information Security Policy",
                "document_number": "DOC-CLOUD-006",
                "issue_date": date(2026, 4, 10),
                "expiry_date": date(2027, 4, 9),
                "status": "Active",
                "notes": "Vendor information security compliance document.",
            },
        ]

        documents_added = 0
        documents_skipped = 0

        for data in documents:

            vendor = db.query(Vendor).filter(
                Vendor.id == data["vendor_id"]
            ).first()

            if not vendor:
                print(
                    f"Skipping document "
                    f"{data['document_number']} - "
                    f"Vendor {data['vendor_id']} not found"
                )
                continue

            existing = db.query(VendorDocument).filter(
                VendorDocument.vendor_id == data["vendor_id"],
                VendorDocument.document_number
                == data["document_number"]
            ).first()

            if existing:
                documents_skipped += 1
                continue

            document = VendorDocument(
                vendor_id=data["vendor_id"],
                document_type=data["document_type"],
                document_name=data["document_name"],
                document_number=data["document_number"],
                issue_date=data["issue_date"],
                expiry_date=data["expiry_date"],
                status=data["status"],
                notes=data["notes"],
            )

            db.add(document)
            documents_added += 1

        # ---------------------------------------------------------
        # SAVE
        # ---------------------------------------------------------

        db.commit()

        print()
        print("-" * 60)
        print("CERTIFICATIONS")
        print("-" * 60)
        print(f"Added   : {certifications_added}")
        print(f"Skipped : {certifications_skipped}")

        print()
        print("-" * 60)
        print("VENDOR DOCUMENTS")
        print("-" * 60)
        print(f"Added   : {documents_added}")
        print(f"Skipped : {documents_skipped}")

        print()
        print("=" * 60)
        print("CONTRACT & COMPLIANCE DATA COMPLETED")
        print("=" * 60)

    except Exception as exc:
        db.rollback()

        print()
        print("=" * 60)
        print("ERROR")
        print("=" * 60)
        print(exc)

    finally:
        db.close()


if __name__ == "__main__":
    main()