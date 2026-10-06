from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import csv
from app.core.database import get_db
from app.models.vendor import Vendor

router = APIRouter(prefix="/reports", tags=["Reporting Service"])

@router.get("/export/vendors/csv")
def export_vendor_performance_csv(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Vendor ID", "Name", "Category", "Status", "Reliability Score", "Risk Level"])
    
    for v in vendors:
        writer.writerow([v.id, v.name, v.category, v.status, getattr(v, "reliability_score", "N/A"), getattr(v, "risk_level", "N/A")])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vendor_reliability_report.csv"}
    )