"""
VendorIQ Report Export Routes (PDF & Excel)
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from backend.auth import get_current_user
from backend.reports_pdf import generate_vendor_performance_pdf, generate_procurement_summary_pdf
from backend.reports_excel import generate_vendor_performance_excel, generate_procurement_excel

router = APIRouter(prefix="/api/reports", tags=["Reports & Exports"])

@router.get("/vendor-pdf")
def export_vendor_pdf(vendor_id: int = Query(...), current_user: dict = Depends(get_current_user)):
    try:
        pdf_bytes = generate_vendor_performance_pdf(vendor_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=VendorIQ_Vendor_{vendor_id}_Report.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/procurement-pdf")
def export_procurement_pdf(current_user: dict = Depends(get_current_user)):
    try:
        pdf_bytes = generate_procurement_summary_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=VendorIQ_Procurement_Summary.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vendor-excel")
def export_vendor_excel(current_user: dict = Depends(get_current_user)):
    try:
        excel_bytes = generate_vendor_performance_excel()
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=VendorIQ_Vendor_Intelligence_Matrix.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/procurement-excel")
def export_procurement_excel(current_user: dict = Depends(get_current_user)):
    try:
        excel_bytes = generate_procurement_excel()
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=VendorIQ_Procurement_Orders.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
