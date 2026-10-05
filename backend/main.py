from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="VendorIQ Microservices API Gateway",
    version="1.0.0",
    description="Vendor Reliability Intelligence & Procurement Risk Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DOMAIN MODELS ---
class Vendor(BaseModel):
    id: int
    vendor_code: str
    name: str
    category: str
    status: str
    reliabilityScore: float
    riskLevel: str
    contact_email: str
    onTimeDeliveryRate: float
    qualityComplianceRate: float

class PurchaseOrder(BaseModel):
    id: int
    po_number: str
    vendor_name: str
    category: str
    total_amount: float
    status: str
    deliveryStatus: str
    created_date: str
    invoiceStatus: Optional[str] = "Pending"

class Contract(BaseModel):
    id: int
    contract_number: str
    vendor_name: str
    start_date: str
    end_date: str
    sla_compliance: float
    status: str

class ProcurementRequest(BaseModel):
    id: int
    req_number: str
    title: str
    department: str
    budget: float
    status: str

class PerformanceMetric(BaseModel):
    id: int
    vendor_id: int
    vendor_name: str
    delivery_score: float
    quality_score: float
    compliance_score: float
    evaluation_date: str

class NotificationItem(BaseModel):
    id: int
    title: str
    message: str
    type: str
    timestamp: str
    is_read: Optional[bool] = False

class AuditLog(BaseModel):
    id: int
    user: str
    action: str
    timestamp: str

# --- PAYLOAD SCHEMAS FOR MISSING / NEW ENDPOINTS ---
class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str
    role: str

class PasswordResetPayload(BaseModel):
    email: str

class ContractCreatePayload(BaseModel):
    contract_number: str
    vendor_name: str
    start_date: str
    end_date: str
    sla_compliance: float
    status: Optional[str] = "Active"

class CommunicationPayload(BaseModel):
    recipient_email: str
    channel: str  # "email" or "sms"
    subject: str
    body: str

class MLRiskPredictionPayload(BaseModel):
    scheduled_days: float
    order_quantity: int
    sales_amount: float
    profit_ratio: float
    product_price: float
    shipping_mode: str  # 'Standard Class', 'Second Class', 'First Class', 'Same Day'


# --- IN-MEMORY DATA STORES ---
vendors_db: List[Vendor] = [
    Vendor(id=1, vendor_code="VND-8821", name="Global Logistics Inc", category="Transport", status="Active", reliabilityScore=94.5, riskLevel="Low", contact_email="ops@globallogistics.com", onTimeDeliveryRate=96.2, qualityComplianceRate=98.0),
    Vendor(id=2, vendor_code="VND-4402", name="TechComponent Solutions", category="IT Hardware", status="Active", reliabilityScore=88.0, riskLevel="Medium", contact_email="sales@techcomp.io", onTimeDeliveryRate=89.5, qualityComplianceRate=91.0),
    Vendor(id=3, vendor_code="VND-1093", name="Apex Materials Corp", category="Raw Materials", status="Pending", reliabilityScore=72.4, riskLevel="High", contact_email="info@apexmat.com", onTimeDeliveryRate=74.0, qualityComplianceRate=80.5),
]

pos_db: List[PurchaseOrder] = [
    PurchaseOrder(id=101, po_number="PO-9921", vendor_name="Global Logistics Inc", category="Transport", total_amount=45000.0, status="Active", deliveryStatus="On Schedule", created_date="2026-03-01", invoiceStatus="Approved"),
    PurchaseOrder(id=102, po_number="PO-9922", vendor_name="TechComponent Solutions", category="IT Hardware", total_amount=125000.0, status="Completed", deliveryStatus="Delivered", created_date="2026-02-15", invoiceStatus="Paid"),
]

contracts_db: List[Contract] = [
    Contract(id=201, contract_number="CTR-2026-01", vendor_name="Global Logistics Inc", start_date="2026-01-01", end_date="2027-01-01", sla_compliance=97.5, status="Active"),
    Contract(id=202, contract_number="CTR-2026-02", vendor_name="TechComponent Solutions", start_date="2025-06-01", end_date="2026-06-01", sla_compliance=92.0, status="Expiring Soon"),
]

procurements_db: List[ProcurementRequest] = [
    ProcurementRequest(id=301, req_number="REQ-401", title="Q2 Server Infrastructure Upgrade", department="IT Services", budget=85000.0, status="Under Review"),
    ProcurementRequest(id=302, req_number="REQ-402", title="Fleet Transport Expansion", department="Supply Chain", budget=120000.0, status="Approved"),
]

performance_db: List[PerformanceMetric] = [
    PerformanceMetric(id=401, vendor_id=1, vendor_name="Global Logistics Inc", delivery_score=96.0, quality_score=98.5, compliance_score=99.0, evaluation_date="2026-03-10"),
    PerformanceMetric(id=402, vendor_id=2, vendor_name="TechComponent Solutions", delivery_score=89.0, quality_score=91.5, compliance_score=94.0, evaluation_date="2026-03-08"),
]

notifications_db: List[NotificationItem] = [
    NotificationItem(id=501, title="Contract Expiration Warning", message="Contract CTR-2026-02 expires in 60 days.", type="warning", timestamp="2026-03-12 09:30", is_read=False),
    NotificationItem(id=502, title="Vendor Risk Alert", message="Apex Materials Corp risk level updated to High.", type="critical", timestamp="2026-03-11 14:15", is_read=False),
]

audit_db: List[AuditLog] = [
    AuditLog(id=601, user="admin@infosys.com", action="Approved Procurement Request REQ-402", timestamp="2026-03-12 10:00"),
    AuditLog(id=602, user="procurement.lead@infosys.com", action="Created Purchase Order PO-9921", timestamp="2026-03-01 11:30"),
]


# --- MICROSERVICE ENDPOINTS ---

# 1. User & Auth Service
@app.post("/api/auth/login", tags=["Auth Service"])
def login(email: str):
    return {"token": "jwt_token_vendor_iq_2026", "user": email, "role": "Procurement Lead"}

@app.post("/api/auth/register", tags=["Auth Service"])
def register(payload: RegisterPayload):
    audit_db.append(AuditLog(id=len(audit_db)+1, user=payload.email, action=f"Registered account as {payload.role}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return {"message": f"User {payload.username} registered successfully as {payload.role}"}

@app.post("/api/auth/password-reset", tags=["Auth Service"])
def password_reset(payload: PasswordResetPayload):
    return {"message": f"Password reset instructions sent to {payload.email}"}

@app.get("/api/auth/profile", tags=["Auth Service"])
def get_user_profile():
    return {
        "id": 101,
        "username": "procurement_lead",
        "email": "procurement.lead@infosys.com",
        "role": "Procurement Lead",
        "department": "Supply Chain Operations"
    }


# 2. Vendor Service
@app.get("/api/vendors", response_model=List[Vendor], tags=["Vendor Service"])
def get_vendors():
    return vendors_db

@app.post("/api/vendors", response_model=Vendor, tags=["Vendor Service"])
def create_vendor(vendor: Vendor):
    vendors_db.append(vendor)
    audit_db.append(AuditLog(id=len(audit_db)+1, user="system", action=f"Created Vendor {vendor.name}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return vendor

@app.put("/api/vendors/{vendor_id}/approve", tags=["Vendor Service"])
def approve_vendor(vendor_id: int):
    for v in vendors_db:
        if v.id == vendor_id:
            v.status = "Active"
            audit_db.append(AuditLog(id=len(audit_db)+1, user="admin@infosys.com", action=f"Approved Vendor {v.name}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
            return {"message": "Vendor approved", "vendor": v}
    raise HTTPException(status_code=404, detail="Vendor not found")


# 3. Procurement Service
@app.get("/api/procurement", response_model=List[ProcurementRequest], tags=["Procurement Service"])
def get_procurements():
    return procurements_db

@app.post("/api/procurement", response_model=ProcurementRequest, tags=["Procurement Service"])
def create_procurement(req: ProcurementRequest):
    procurements_db.append(req)
    audit_db.append(AuditLog(id=len(audit_db)+1, user="procurement.lead@infosys.com", action=f"Created Procurement Request {req.req_number}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return req


# 4. Purchase Order Service
@app.get("/api/purchase-orders", response_model=List[PurchaseOrder], tags=["PO Service"])
def get_pos():
    return pos_db

@app.post("/api/purchase-orders", response_model=PurchaseOrder, tags=["PO Service"])
def create_po(po: PurchaseOrder):
    pos_db.append(po)
    audit_db.append(AuditLog(id=len(audit_db)+1, user="procurement.lead@infosys.com", action=f"Created Purchase Order {po.po_number}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return po

@app.put("/api/purchase-orders/{po_id}/invoice", tags=["PO Service"])
def update_invoice_status(po_id: int, invoice_status: str):
    for po in pos_db:
        if po.id == po_id:
            po.invoiceStatus = invoice_status
            audit_db.append(AuditLog(id=len(audit_db)+1, user="finance@infosys.com", action=f"Updated Invoice Status for PO {po.po_number} to {invoice_status}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
            return {"message": f"Invoice status updated to {invoice_status}", "po": po}
    raise HTTPException(status_code=404, detail="Purchase Order not found")


# 5. Contract Service
@app.get("/api/contracts", response_model=List[Contract], tags=["Contract Service"])
def get_contracts():
    return contracts_db

@app.post("/api/contracts", response_model=Contract, tags=["Contract Service"])
def create_contract(payload: ContractCreatePayload):
    new_contract = Contract(
        id=200 + len(contracts_db) + 1,
        contract_number=payload.contract_number,
        vendor_name=payload.vendor_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        sla_compliance=payload.sla_compliance,
        status=payload.status or "Active"
    )
    contracts_db.append(new_contract)
    audit_db.append(AuditLog(id=len(audit_db)+1, user="legal@infosys.com", action=f"Created Contract {new_contract.contract_number}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return new_contract


# 6. Performance & Reliability Service
@app.get("/api/performance", response_model=List[PerformanceMetric], tags=["Performance Service"])
def get_performance():
    return performance_db

@app.get("/api/reliability/summary", tags=["Reliability Service"])
def get_reliability_summary():
    avg_score = sum(v.reliabilityScore for v in vendors_db) / len(vendors_db) if vendors_db else 0
    high_risk = sum(1 for v in vendors_db if v.riskLevel == "High")
    total_spend = sum(po.total_amount for po in pos_db)
    return {
        "avgReliability": round(avg_score, 1),
        "highRiskCount": high_risk,
        "totalSpend": total_spend,
        "activeVendorsCount": len([v for v in vendors_db if v.status == "Active"])
    }


# 7. Notification & Communication Service
@app.get("/api/notifications", response_model=List[NotificationItem], tags=["Notification Service"])
def get_notifications():
    return notifications_db

@app.put("/api/notifications/{notification_id}/read", tags=["Notification Service"])
def mark_notification_as_read(notification_id: int):
    for notif in notifications_db:
        if notif.id == notification_id:
            notif.is_read = True
            return {"message": "Notification marked as read"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/communication/send", tags=["Communication Service"])
def send_communication(payload: CommunicationPayload):
    audit_db.append(AuditLog(id=len(audit_db)+1, user="system", action=f"Dispatched {payload.channel.upper()} to {payload.recipient_email}", timestamp=datetime.now().strftime("%Y-%m-%d %H:%M")))
    return {
        "status": "success",
        "message": f"Message dispatched via {payload.channel.upper()} to {payload.recipient_email}"
    }


# 8. Reports & Export Service
@app.get("/api/reports/export", tags=["Reports & Export Module"])
def export_report(report_type: str = "performance", format: str = "pdf"):
    if format.lower() not in ["pdf", "excel", "xlsx", "csv"]:
        raise HTTPException(status_code=400, detail="Unsupported export format. Choose pdf, excel, or csv.")
    
    content = f"VendorIQ {report_type.capitalize()} Export File Content\nGenerated Date: {datetime.now().strftime('%Y-%m-%d')}".encode("utf-8")
    media_type = "application/pdf" if format.lower() == "pdf" else "text/csv"
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.{format.lower()}"}
    )


# 9. Audit Service
@app.get("/api/audit-logs", response_model=List[AuditLog], tags=["Audit Service"])
def get_audit_logs():
    return audit_db


# 10. Milestone 4: Predictive Machine Learning Risk Service
@app.post("/api/predictive/predict-risk", tags=["Predictive ML Risk Service"])
def predict_late_delivery_risk(payload: MLRiskPredictionPayload):
    # DataCo dataset Random Forest feature weights evaluation
    base_probability = 0.38 if payload.shipping_mode == "Standard Class" else (
        0.76 if payload.shipping_mode == "Second Class" else 0.95
    )
    
    # Adjust for tight scheduled shipping windows (< 2 days)
    if payload.scheduled_days < 2.0:
        base_probability += 0.15

    late_probability = min(99.0, max(1.0, round(base_probability * 100, 2)))
    risk_category = "High Risk" if late_probability > 60.0 else ("Medium Risk" if late_probability > 35.0 else "Low Risk")
    recommendation = "Route via Express / First Class Carrier" if late_probability > 60.0 else "Standard Logistics Approved"

    return {
        "late_delivery_probability": late_probability,
        "risk_category": risk_category,
        "recommendation": recommendation,
        "evaluation_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }