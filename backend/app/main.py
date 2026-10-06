from datetime import date
from io import BytesIO
import csv
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from .db import Base, engine, get_db, SessionLocal
from .models import *
from .schemas import *
from .auth import *
from .seed import seed

app = FastAPI(title="Vendor Intelligence Platform API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:4200","http://127.0.0.1:4200"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db=SessionLocal()
    try: seed(db)
    finally: db.close()

@app.get("/api/v1/health")
def health(db: Session=Depends(get_db)):
    db.execute(func.now())
    return {"status":"ok","database":"connected"}

@app.post("/api/v1/auth/register", response_model=LoginOut)
def register(data:RegisterIn, db:Session=Depends(get_db)):
    if db.query(User).filter_by(email=data.email).first(): raise HTTPException(400,"Email already registered")
    if data.role not in {"Vendor","Procurement Manager","Supply Chain Manager","Finance Officer","Auditor","Administrator"}:
        raise HTTPException(400,"Invalid role")
    u=User(email=data.email,password_hash=hash_password(data.password),full_name=data.full_name,role=data.role)
    db.add(u); db.commit(); db.refresh(u)
    return {"access_token":create_token(u),"role":u.role,"full_name":u.full_name}

@app.post("/api/v1/auth/login", response_model=LoginOut)
def login(data:dict, db:Session=Depends(get_db)):
    email=data.get("email",""); password=data.get("password","")
    u=db.query(User).filter_by(email=email).first()
    if not u or not verify_password(password,u.password_hash): raise HTTPException(401,"Invalid email or password")
    return {"access_token":create_token(u),"role":u.role,"full_name":u.full_name}

@app.get("/api/v1/auth/me")
def me(user:User=Depends(current_user)):
    return {"id":user.id,"email":user.email,"full_name":user.full_name,"role":user.role,"vendor_id":user.vendor_id}

@app.get("/api/v1/vendors")
def vendors(db:Session=Depends(get_db), user:User=Depends(current_user)):
    q=db.query(Vendor)
    if user.role=="Vendor": q=q.filter(Vendor.id==user.vendor_id)
    return q.order_by(Vendor.name).all()

@app.post("/api/v1/vendors")
def create_vendor(data:VendorIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Procurement Manager"))):
    v=Vendor(**data.model_dump(),status="Pending"); db.add(v); db.commit(); db.refresh(v)
    db.add(ActivityLog(user_id=user.id,action="Vendor registered",entity="vendor",entity_id=v.id)); db.commit()
    return v

@app.patch("/api/v1/vendors/{vendor_id}/status")
def vendor_status(vendor_id:int, data:StatusIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Procurement Manager"))):
    v=db.get(Vendor,vendor_id)
    if not v: raise HTTPException(404,"Vendor not found")
    if data.status not in {"Pending","Under Review","Approved","Rejected"}: raise HTTPException(400,"Invalid vendor status")
    v.status=data.status; db.add(ActivityLog(user_id=user.id,action=f"Vendor status changed to {data.status}",entity="vendor",entity_id=v.id)); db.commit()
    return v

@app.get("/api/v1/purchase-orders")
def purchase_orders(db:Session=Depends(get_db), user:User=Depends(current_user)):
    q=db.query(PurchaseOrder)
    if user.role=="Vendor": q=q.filter(PurchaseOrder.vendor_id==user.vendor_id)
    return q.order_by(desc(PurchaseOrder.id)).all()

@app.post("/api/v1/purchase-orders")
def create_po(data:POIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Procurement Manager"))):
    v=db.get(Vendor,data.vendor_id)
    if not v or v.status!="Approved": raise HTTPException(400,"Purchase order requires an approved vendor")
    number=f"PO-{1000+db.query(PurchaseOrder).count()+1}"
    po=PurchaseOrder(po_number=number,vendor_id=v.id,item=data.item,quantity=data.quantity,unit_price=data.unit_price,total_amount=data.quantity*data.unit_price,order_date=date.today(),expected_delivery=data.expected_delivery,status="Pending")
    db.add(po); db.commit(); db.refresh(po)
    db.add(ActivityLog(user_id=user.id,action="Purchase order created",entity="purchase_order",entity_id=po.id)); db.commit()
    return po

@app.patch("/api/v1/purchase-orders/{po_id}/status")
def po_status(po_id:int, data:StatusIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Procurement Manager","Supply Chain Manager"))):
    allowed={"Pending","Approved","Ordered","Delivered","Completed","Cancelled"}
    if data.status not in allowed: raise HTTPException(400,"Invalid PO status")
    po=db.get(PurchaseOrder,po_id)
    if not po: raise HTTPException(404,"PO not found")
    po.status=data.status
    if data.status=="Delivered" and not po.actual_delivery: po.actual_delivery=date.today()
    db.add(ActivityLog(user_id=user.id,action=f"PO {po.po_number} moved to {data.status}",entity="purchase_order",entity_id=po.id))
    db.commit()
    return po

@app.get("/api/v1/contracts")
def contracts(db:Session=Depends(get_db), user:User=Depends(current_user)):
    q=db.query(Contract)
    if user.role=="Vendor": q=q.filter(Contract.vendor_id==user.vendor_id)
    return q.order_by(Contract.expiry_date).all()

@app.post("/api/v1/contracts")
def create_contract(data:ContractIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Procurement Manager"))):
    c=Contract(**data.model_dump()); db.add(c); db.commit(); db.refresh(c); return c

@app.get("/api/v1/messages")
def messages(db:Session=Depends(get_db), user:User=Depends(current_user)):
    q=db.query(Message)
    if user.role=="Vendor": q=q.filter(Message.vendor_id==user.vendor_id)
    return q.order_by(desc(Message.id)).all()

@app.post("/api/v1/messages")
def send_message(data:MessageIn, db:Session=Depends(get_db), user:User=Depends(current_user)):
    if user.role=="Vendor" and data.vendor_id!=user.vendor_id: raise HTTPException(403,"Not your vendor record")
    m=Message(vendor_id=data.vendor_id,sender=user.full_name,body=data.body); db.add(m); db.commit(); db.refresh(m); return m

def score(vendor_id:int, db:Session):
    records=db.query(PerformanceRecord).filter_by(vendor_id=vendor_id).order_by(PerformanceRecord.period).all()
    if not records: return None
    r=records[-1]
    delivery=100*r.on_time_deliveries/r.total_deliveries if r.total_deliveries else 0
    quality=min(100,20*r.quality_rating)
    communication=100 if r.response_hours<=4 else 85 if r.response_hours<=8 else 70 if r.response_hours<=16 else 40
    compliance=100*r.contracts_passed/r.contracts_checked if r.contracts_checked else 0
    purchase=100*r.orders_completed/r.orders_total if r.orders_total else 0
    issues=100*r.issues_resolved_on_time/r.issues_total if r.issues_total else 0
    total=delivery*.30+quality*.20+communication*.15+compliance*.15+purchase*.10+issues*.10
    risk="Low" if total>=80 else "Medium" if total>=60 else "High"
    return {"vendor_id":vendor_id,"score":round(total,1),"risk":risk,"factors":{"delivery":round(delivery,1),"quality":round(quality,1),"communication":round(communication,1),"compliance":round(compliance,1),"purchase_history":round(purchase,1),"issue_resolution":round(issues,1)},"latest_period":r.period}

@app.get("/api/v1/analytics")
def analytics(db:Session=Depends(get_db), user:User=Depends(current_user)):
    vs=db.query(Vendor)
    if user.role=="Vendor": vs=vs.filter(Vendor.id==user.vendor_id)
    result=[]
    for v in vs.all():
        s=score(v.id,db)
        if s: result.append({**s,"vendor_name":v.name,"category":v.category})
    result.sort(key=lambda x:x["score"],reverse=True)
    return {"vendors":result,"ranking":result}

@app.get("/api/v1/performance/{vendor_id}")
def performance(vendor_id:int, db:Session=Depends(get_db), user:User=Depends(current_user)):
    if user.role=="Vendor" and user.vendor_id!=vendor_id: raise HTTPException(403,"Not authorized")
    return db.query(PerformanceRecord).filter_by(vendor_id=vendor_id).order_by(PerformanceRecord.period).all()

@app.post("/api/v1/performance")
def add_performance(data:PerformanceIn, db:Session=Depends(get_db), user:User=Depends(require_roles("Administrator","Supply Chain Manager"))):
    p=PerformanceRecord(**data.model_dump()); db.add(p); db.commit(); db.refresh(p); return p

@app.get("/api/v1/notifications")
def notifications(db:Session=Depends(get_db), user:User=Depends(current_user)):
    return db.query(Notification).filter((Notification.user_id==None)|(Notification.user_id==user.id)).order_by(desc(Notification.id)).all()

@app.get("/api/v1/reports/vendors.csv")
def vendor_report(db:Session=Depends(get_db), user:User=Depends(current_user)):
    rows=analytics(db,user)["vendors"]
    out=BytesIO(); text=out
    import io
    s=io.StringIO(); w=csv.writer(s); w.writerow(["Vendor","Category","Reliability","Risk","Delivery","Quality","Communication","Compliance","Purchase History","Issue Resolution"])
    for x in rows:
        f=x["factors"]; w.writerow([x["vendor_name"],x["category"],x["score"],x["risk"],f["delivery"],f["quality"],f["communication"],f["compliance"],f["purchase_history"],f["issue_resolution"]])
    return Response(s.getvalue(),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=vendor_reliability_report.csv"})

@app.get("/api/v1/reports/vendors.xlsx")
def vendor_xlsx(db:Session=Depends(get_db), user:User=Depends(current_user)):
    from openpyxl import Workbook
    wb=Workbook(); ws=wb.active; ws.title="Vendor Reliability"
    ws.append(["Vendor","Category","Reliability","Risk","Delivery","Quality","Communication","Compliance","Purchase History","Issue Resolution"])
    for x in analytics(db,user)["vendors"]:
        f=x["factors"]; ws.append([x["vendor_name"],x["category"],x["score"],x["risk"],f["delivery"],f["quality"],f["communication"],f["compliance"],f["purchase_history"],f["issue_resolution"]])
    buf=BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":"attachment; filename=vendor_reliability_report.xlsx"})
