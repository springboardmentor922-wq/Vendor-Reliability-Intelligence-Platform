from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, date, timedelta
from app.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest, PurchaseOrder, PurchaseOrderItem, Invoice
from app.models.contract import Contract, Certification
from app.models.communication import Message
from app.models.audit import AuditLog
from app.models.performance import PerformanceRecord, ReliabilityScore
from app.models.enums import (
    UserRole, VendorStatus, RequestStatus, POStatus, InvoiceStatus, ContractStatus
)
from app.core.dependencies import get_current_user
from app.routers.analytics import compute_vendor_intelligence

router = APIRouter(prefix="/dashboard", tags=["Dashboard Analytics"])

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role = current_user.role
    today = date.today()

    if role == UserRole.ADMINISTRATOR:
        total_users = db.query(User).count()
        total_vendors = db.query(Vendor).count()
        pending_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.PENDING).count()
        approved_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.APPROVED).count()
        total_orders = db.query(PurchaseOrder).count()
        total_invoices = db.query(Invoice).count()
        total_contracts = db.query(Contract).count()
        recent_logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(8).all()
        
        roles_count = {
            r.value: db.query(User).filter(User.role == r).count() for r in UserRole
        }

        # Calculate live risk tiers for all approved vendors
        all_vendors = db.query(Vendor).all()
        risk_dist = {"Low Risk": 0, "Medium Risk": 0, "High Risk": 0, "Critical Risk": 0}
        for v in all_vendors:
            intel = compute_vendor_intelligence(v, db)
            rl = intel.get("risk_level", "Low")
            if rl == "Low":
                risk_dist["Low Risk"] += 1
            elif rl == "Medium-Low":
                risk_dist["Medium Risk"] += 1
            elif rl == "Medium":
                risk_dist["High Risk"] += 1
            else:
                risk_dist["Critical Risk"] += 1

        # Procurement monthly cost in Lakhs and PO counts directly from DB
        months_map = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            months_map[m_key] = {"month": m_key, "cost": 0.0, "pos": 0}
        
        all_admin_pos = db.query(PurchaseOrder).all()
        for p in all_admin_pos:
            m_key = p.created_at.strftime("%b") if p.created_at else "Sep"
            if m_key in months_map:
                months_map[m_key]["pos"] += 1
                months_map[m_key]["cost"] = round(months_map[m_key]["cost"] + (p.total_amount / 100000.0), 2)
            else:
                months_map[m_key] = {"month": m_key, "cost": round(p.total_amount / 100000.0, 2), "pos": 1}
        
        procurement_reports = list(months_map.values())
        if not procurement_reports:
            procurement_reports = [{"month": "Sep", "cost": 0.0, "pos": 0}]

        # Live compliance breakdown
        compliant_count = db.query(Contract).filter(Contract.status == ContractStatus.ACTIVE).count()
        expiring_count = db.query(Contract).filter(Contract.status == ContractStatus.EXPIRING_SOON).count()
        expired_count = db.query(Contract).filter(Contract.status == ContractStatus.EXPIRED).count()
        total_c = max(1, compliant_count + expiring_count + expired_count)

        compliance_summary = {
            "compliant_pct": round((compliant_count / total_c) * 100),
            "minor_issues_pct": round((expiring_count / total_c) * 100),
            "major_issues_pct": round((expired_count / total_c) * 100),
            "non_compliant_pct": max(0, 100 - round((compliant_count / total_c) * 100) - round((expiring_count / total_c) * 100) - round((expired_count / total_c) * 100))
        }

        roles_palette = {
            UserRole.ADMINISTRATOR.value: "#f43f5e",
            UserRole.PROCUREMENT_MANAGER.value: "#0284c7",
            UserRole.SUPPLY_CHAIN_MANAGER.value: "#38bdf8",
            UserRole.FINANCE_OFFICER.value: "#f59e0b",
            UserRole.VENDOR.value: "#8b5cf6",
            UserRole.AUDITOR.value: "#10b981"
        }
        total_u = max(1, total_users)
        roles_donut = [
            {
                "name": r_name,
                "value": count,
                "pct": round((count / total_u) * 100),
                "color": roles_palette.get(r_name, "#64748b")
            }
            for r_name, count in roles_count.items() if count > 0
        ]

        total_risk = max(1, sum(risk_dist.values()))
        risk_palette = {
            "Low Risk": "#10b981",
            "Medium Risk": "#0284c7",
            "High Risk": "#f59e0b",
            "Critical Risk": "#f43f5e"
        }
        risk_donut = [
            {
                "name": k,
                "value": v,
                "pct": round((v / total_risk) * 100),
                "color": risk_palette.get(k, "#64748b")
            }
            for k, v in risk_dist.items() if v > 0
        ]
        if not risk_donut:
            risk_donut = [{"name": "Low Risk", "value": 1, "pct": 100, "color": "#10b981"}]

        return {
            "role": role.value,
            "metrics": {
                "total_users": total_users,
                "total_vendors": total_vendors,
                "pending_vendors": pending_vendors,
                "approved_vendors": approved_vendors,
                "total_orders": total_orders,
                "total_invoices": total_invoices,
                "total_contracts": total_contracts,
                "system_uptime": 99.9,
                "db_usage": 45,
                "api_response_time": 35,
                "active_sessions": total_users,
                "storage_usage": 38
            },
            "roles_distribution": roles_count,
            "roles_donut": roles_donut,
            "risk_distribution": risk_dist,
            "risk_donut": risk_donut,
            "procurement_reports": procurement_reports,
            "compliance_summary": compliance_summary,
            "recent_logs": [
                {"id": l.id, "action": l.action, "entity": l.entity, "details": l.details, "created_at": l.created_at}
                for l in recent_logs
            ]
        }

    elif role == UserRole.PROCUREMENT_MANAGER:
        pending_requests = db.query(ProcurementRequest).filter(ProcurementRequest.status == RequestStatus.PENDING).count()
        total_requests = db.query(ProcurementRequest).count()
        pending_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.PENDING).count()
        active_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ORDERED])).count()
        total_spend = db.query(func.sum(PurchaseOrder.total_amount)).scalar() or 0.0
        pending_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.PENDING).count()
        active_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.APPROVED).count()
        total_orders_count = db.query(PurchaseOrder).count()
        all_pos = db.query(PurchaseOrder).all()

        po_by_status = {
            s.value: db.query(PurchaseOrder).filter(PurchaseOrder.status == s).count() for s in POStatus
        }
        recent_orders = db.query(PurchaseOrder).order_by(PurchaseOrder.id.desc()).limit(5).all()

        # Monthly procurement spend trajectory and order volume
        p_months = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            p_months[m_key] = {"month": m_key, "cost": 0.0, "pos": 0}
        
        for p in all_pos:
            m_key = p.created_at.strftime("%b") if p.created_at else "Sep"
            if m_key in p_months:
                p_months[m_key]["pos"] += 1
                p_months[m_key]["cost"] = round(p_months[m_key]["cost"] + (p.total_amount / 100000.0), 2)
            else:
                p_months[m_key] = {"month": m_key, "cost": round(p.total_amount / 100000.0, 2), "pos": 1}
        procurement_overview = list(p_months.values())

        # PO status distribution
        total_p = max(1, total_orders_count)
        pending_c = po_by_status.get(POStatus.PENDING.value, 0)
        approved_c = po_by_status.get(POStatus.APPROVED.value, 0)
        ordered_c = po_by_status.get(POStatus.ORDERED.value, 0)
        delivered_c = po_by_status.get(POStatus.DELIVERED.value, 0) + po_by_status.get(POStatus.COMPLETED.value, 0)
        cancelled_c = po_by_status.get(POStatus.CANCELLED.value, 0)

        active_pos_breakdown = [
            {"name": "Pending Approval", "value": pending_c, "pct": round(pending_c / total_p * 100), "color": "#0284c7"},
            {"name": "Approved", "value": approved_c, "pct": round(approved_c / total_p * 100), "color": "#38bdf8"},
            {"name": "In Progress / Ordered", "value": ordered_c, "pct": round(ordered_c / total_p * 100), "color": "#f59e0b"},
            {"name": "Delivered", "value": delivered_c, "pct": round(delivered_c / total_p * 100), "color": "#10b981"},
            {"name": "Cancelled", "value": cancelled_c, "pct": round(cancelled_c / total_p * 100), "color": "#f43f5e"}
        ]

        # Vendor performance radar metrics
        all_v_intel = [compute_vendor_intelligence(v, db) for v in db.query(Vendor).all()]
        if all_v_intel:
            top_v = max(all_v_intel, key=lambda x: x["reliability_score"])
            avg_del = round(sum(x["on_time_delivery_rate"] for x in all_v_intel) / len(all_v_intel), 1)
            avg_qual = round(sum(x["average_quality_rating"] * 20.0 for x in all_v_intel) / len(all_v_intel), 1)
            avg_comm = round(sum(max(40.0, 100.0 - (x["average_response_hours"] * 5.0)) for x in all_v_intel) / len(all_v_intel), 1)
            avg_comp = round(sum(x["order_completion_rate"] for x in all_v_intel) / len(all_v_intel), 1)
            avg_rel = round(sum(x["reliability_score"] for x in all_v_intel) / len(all_v_intel), 1)
            
            radar_performance = [
                {"subject": "Delivery", "top_vendor": round(top_v["on_time_delivery_rate"], 1), "average": avg_del, "fullMark": 100},
                {"subject": "Quality", "top_vendor": round(top_v["average_quality_rating"] * 20.0, 1), "average": avg_qual, "fullMark": 100},
                {"subject": "Communication", "top_vendor": round(max(50.0, 100.0 - (top_v["average_response_hours"] * 5.0)), 1), "average": avg_comm, "fullMark": 100},
                {"subject": "Compliance", "top_vendor": 95.0, "average": 85.0, "fullMark": 100},
                {"subject": "Cost Efficiency", "top_vendor": round(top_v["reliability_score"], 1), "average": avg_rel, "fullMark": 100}
            ]
        else:
            radar_performance = [
                {"subject": "Delivery", "top_vendor": 95, "average": 78, "fullMark": 100},
                {"subject": "Quality", "top_vendor": 92, "average": 82, "fullMark": 100},
                {"subject": "Communication", "top_vendor": 88, "average": 74, "fullMark": 100},
                {"subject": "Compliance", "top_vendor": 96, "average": 85, "fullMark": 100},
                {"subject": "Cost Efficiency", "top_vendor": 90, "average": 79, "fullMark": 100}
            ]

        # Spend breakdown by vendor category
        category_costs = {}
        for p in all_pos:
            if p.status == POStatus.CANCELLED:
                continue
            cat_name = p.vendor.category.value if p.vendor and hasattr(p.vendor.category, "value") else "other"
            cat_label = cat_name.replace("_", " ").title()
            category_costs[cat_label] = category_costs.get(cat_label, 0.0) + p.total_amount

        total_cat_cost = max(1.0, sum(category_costs.values()))
        cat_palette = ["#0284c7", "#f43f5e", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"]
        cost_by_category = []
        for idx, (cat, val) in enumerate(category_costs.items()):
            cost_by_category.append({
                "name": cat,
                "value": round(val / 100000.0, 2),
                "pct": round(val / total_cat_cost * 100),
                "color": cat_palette[idx % len(cat_palette)]
            })
        if not cost_by_category:
            cost_by_category = [{"name": "Raw Materials", "value": 0.0, "pct": 100, "color": "#0284c7"}]

        # Fulfillment and delivery performance breakdown
        delivered_orders_db = [p for p in all_pos if p.status in [POStatus.DELIVERED, POStatus.COMPLETED]]
        in_transit_db = [p for p in all_pos if p.status == POStatus.ORDERED]
        overdue_db = [p for p in all_pos if p.status in [POStatus.PENDING, POStatus.APPROVED, POStatus.ORDERED] and str(p.expected_delivery_date) < str(today)]
        ontime_delivered = sum(1 for p in delivered_orders_db if p.actual_delivery_date and p.actual_delivery_date <= p.expected_delivery_date)
        ontime_pct = round((ontime_delivered / max(1, len(delivered_orders_db))) * 100) if delivered_orders_db else 100

        delivery_status = {
            "ontime_rate": ontime_pct,
            "items": [
                {"label": "Delivered", "pct": round(len(delivered_orders_db) / total_p * 100), "count": len(delivered_orders_db), "color": "#10b981"},
                {"label": "In Transit", "pct": round(len(in_transit_db) / total_p * 100), "count": len(in_transit_db), "color": "#0284c7"},
                {"label": "Delayed", "pct": round(len(overdue_db) / total_p * 100), "count": len(overdue_db), "color": "#f59e0b"},
                {"label": "Cancelled", "pct": round(cancelled_c / total_p * 100), "count": cancelled_c, "color": "#f43f5e"}
            ]
        }

        items_procured_count = int(db.query(func.sum(PurchaseOrderItem.quantity)).scalar() or 0)

        return {
            "role": role.value,
            "metrics": {
                "total_orders": total_orders_count,
                "total_procurement_cost_display": f"₹ {total_spend:,.2f}",
                "total_procurement_spend": round(total_spend, 2),
                "active_vendors": active_vendors,
                "items_procured": items_procured_count,
                "pending_requests": pending_requests,
                "total_requests": total_requests,
                "pending_pos": pending_pos,
                "active_pos": active_pos,
                "pending_vendor_approvals": pending_vendors
            },
            "po_by_status": po_by_status,
            "procurement_overview": procurement_overview,
            "active_pos_breakdown": active_pos_breakdown,
            "radar_performance": radar_performance,
            "cost_by_category": cost_by_category,
            "delivery_status": delivery_status,
            "recent_orders": [
                {
                    "id": o.id,
                    "po_number": o.po_number,
                    "vendor": o.vendor.company_name if o.vendor else "N/A",
                    "total_amount": o.total_amount,
                    "status": o.status.value,
                    "expected_delivery_date": o.expected_delivery_date
                } for o in recent_orders
            ]
        }

    elif role == UserRole.SUPPLY_CHAIN_MANAGER:
        total_pos = db.query(PurchaseOrder).count()
        pending_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.PENDING).count()
        approved_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.APPROVED).count()
        ordered_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.ORDERED).count()
        delivered_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.DELIVERED).count()
        completed_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.COMPLETED).count()
        cancelled_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == POStatus.CANCELLED).count()

        all_pos = db.query(PurchaseOrder).all()
        total_p = max(1, total_pos)

        # Delayed orders
        overdue_pos = [
            p for p in all_pos
            if p.status in [POStatus.PENDING, POStatus.APPROVED, POStatus.ORDERED]
            and p.expected_delivery_date < today
        ]
        delayed_pos_count = len(overdue_pos)

        delivered_all = [p for p in all_pos if p.status in [POStatus.DELIVERED, POStatus.COMPLETED]]
        ontime_delivered = sum(1 for p in delivered_all if p.actual_delivery_date and p.actual_delivery_date <= p.expected_delivery_date)
        ontime_pct = round((ontime_delivered / max(1, len(delivered_all))) * 100) if delivered_all else 100

        active_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.APPROVED).count()
        expiring_contracts = db.query(Contract).filter(
            Contract.end_date <= today + timedelta(days=30),
            Contract.status != ContractStatus.TERMINATED
        ).count()
        total_items_volume = int(db.query(func.sum(PurchaseOrderItem.quantity)).scalar() or 0)

        # 1. 6-Month Supply Chain Delivery Performance Trend (Dual Axis Chart)
        months_map = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            months_map[m_key] = {"month": m_key, "on_time": 0, "delayed": 0, "shipments": 0}

        for p in all_pos:
            m_key = p.created_at.strftime("%b") if p.created_at else "Sep"
            if m_key in months_map:
                months_map[m_key]["shipments"] += 1
                if p.actual_delivery_date and p.actual_delivery_date <= p.expected_delivery_date:
                    months_map[m_key]["on_time"] += 1
                elif (p.actual_delivery_date and p.actual_delivery_date > p.expected_delivery_date) or (p.expected_delivery_date < today and p.status not in [POStatus.DELIVERED, POStatus.COMPLETED, POStatus.CANCELLED]):
                    months_map[m_key]["delayed"] += 1
                else:
                    months_map[m_key]["on_time"] += 1
        delivery_performance_trend = list(months_map.values())

        # 2. Active Shipment Pipeline Donut
        shipment_pipeline_donut = [
            {"name": "In-Transit", "value": ordered_pos, "pct": round(ordered_pos / total_p * 100), "color": "#0284c7"},
            {"name": "Delivered", "value": delivered_pos + completed_pos, "pct": round((delivered_pos + completed_pos) / total_p * 100), "color": "#10b981"},
            {"name": "Pending Dispatch", "value": approved_pos, "pct": round(approved_pos / total_p * 100), "color": "#38bdf8"},
            {"name": "Delayed", "value": delayed_pos_count, "pct": round(delayed_pos_count / total_p * 100), "color": "#f59e0b"},
            {"name": "Cancelled", "value": cancelled_pos, "pct": round(cancelled_pos / total_p * 100), "color": "#f43f5e"}
        ]

        # 3. Supply Chain Logistics Radar Chart
        all_v_intel = [compute_vendor_intelligence(v, db) for v in db.query(Vendor).all()]
        if all_v_intel:
            top_v = max(all_v_intel, key=lambda x: x["reliability_score"])
            avg_del = round(sum(x["on_time_delivery_rate"] for x in all_v_intel) / len(all_v_intel), 1)
            avg_qual = round(sum(x["average_quality_rating"] * 20.0 for x in all_v_intel) / len(all_v_intel), 1)
            avg_comm = round(sum(max(40.0, 100.0 - (x["average_response_hours"] * 5.0)) for x in all_v_intel) / len(all_v_intel), 1)
            avg_comp = round(sum(x["order_completion_rate"] for x in all_v_intel) / len(all_v_intel), 1)
            avg_turn = round(sum(max(30.0, 100.0 - (x["issue_resolution_hours"] * 1.5)) for x in all_v_intel) / len(all_v_intel), 1)

            logistics_radar = [
                {"subject": "Delivery Speed", "top_vendor": round(top_v["on_time_delivery_rate"], 1), "average": avg_del, "fullMark": 100},
                {"subject": "Quality Standard", "top_vendor": round(top_v["average_quality_rating"] * 20.0, 1), "average": avg_qual, "fullMark": 100},
                {"subject": "Responsiveness", "top_vendor": round(max(50.0, 100.0 - (top_v["average_response_hours"] * 5.0)), 1), "average": avg_comm, "fullMark": 100},
                {"subject": "Fulfillment Rate", "top_vendor": round(top_v["order_completion_rate"], 1), "average": avg_comp, "fullMark": 100},
                {"subject": "Issue Turnaround", "top_vendor": round(max(50.0, 100.0 - (top_v["issue_resolution_hours"] * 1.5)), 1), "average": avg_turn, "fullMark": 100}
            ]
        else:
            logistics_radar = [
                {"subject": "Delivery Speed", "top_vendor": 95, "average": 80, "fullMark": 100},
                {"subject": "Quality Standard", "top_vendor": 92, "average": 82, "fullMark": 100},
                {"subject": "Responsiveness", "top_vendor": 88, "average": 75, "fullMark": 100},
                {"subject": "Fulfillment Rate", "top_vendor": 96, "average": 84, "fullMark": 100},
                {"subject": "Issue Turnaround", "top_vendor": 90, "average": 78, "fullMark": 100}
            ]

        # 4. On-Time Delivery Rate by Category
        category_orders = {}
        for p in all_pos:
            c_name = p.vendor.category.value if p.vendor and hasattr(p.vendor.category, "value") else "general"
            lbl = c_name.replace("_", " ").title()
            if lbl not in category_orders:
                category_orders[lbl] = {"total": 0, "ontime": 0}
            category_orders[lbl]["total"] += 1
            if p.actual_delivery_date and p.actual_delivery_date <= p.expected_delivery_date:
                category_orders[lbl]["ontime"] += 1
            elif not p.actual_delivery_date and (p.expected_delivery_date >= today):
                category_orders[lbl]["ontime"] += 1

        cat_logistics = []
        for cat, stats in category_orders.items():
            rate = round((stats["ontime"] / max(1, stats["total"])) * 100)
            cat_logistics.append({"category": cat, "on_time_rate": rate, "orders": stats["total"]})

        delivery_status = {
            "ontime_rate": ontime_pct,
            "items": [
                {"label": "Delivered", "pct": round((delivered_pos + completed_pos) / total_p * 100), "count": delivered_pos + completed_pos, "color": "#10b981"},
                {"label": "In Transit", "pct": round(ordered_pos / total_p * 100), "count": ordered_pos, "color": "#0284c7"},
                {"label": "Delayed", "pct": round(delayed_pos_count / total_p * 100), "count": delayed_pos_count, "color": "#f59e0b"},
                {"label": "Cancelled", "pct": round(cancelled_pos / total_p * 100), "count": cancelled_pos, "color": "#f43f5e"}
            ]
        }

        recent_orders = [
            {
                "id": o.id,
                "po_number": o.po_number,
                "vendor": o.vendor.company_name if o.vendor else "N/A",
                "total_amount": o.total_amount,
                "status": o.status.value,
                "expected_delivery_date": o.expected_delivery_date
            }
            for o in db.query(PurchaseOrder).order_by(PurchaseOrder.id.desc()).limit(6).all()
        ]

        return {
            "role": role.value,
            "metrics": {
                "total_orders": total_pos,
                "in_transit_orders": ordered_pos,
                "delivered_orders": delivered_pos + completed_pos,
                "completed_orders": completed_pos,
                "delayed_orders": delayed_pos_count,
                "active_vendors": active_vendors,
                "expiring_contracts": expiring_contracts,
                "on_time_delivery_rate": ontime_pct,
                "total_logistics_volume": total_items_volume
            },
            "delivery_performance_trend": delivery_performance_trend,
            "shipment_pipeline_donut": shipment_pipeline_donut,
            "logistics_radar": logistics_radar,
            "category_logistics_bar": cat_logistics,
            "delivery_status": delivery_status,
            "recent_orders": recent_orders
        }

    elif role == UserRole.VENDOR:
        vid = current_user.vendor_id
        if not vid:
            return {"role": role.value, "metrics": {}, "error": "No vendor profile linked to this user."}

        vendor = db.query(Vendor).filter(Vendor.id == vid).first()
        intel = compute_vendor_intelligence(vendor, db) if vendor else {}

        # Active POs
        active_pos_list = db.query(PurchaseOrder).filter(
            PurchaseOrder.vendor_id == vid,
            PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ORDERED])
        ).all()
        active_pos = len(active_pos_list)
        active_commitment = sum(p.total_amount for p in active_pos_list)

        # Delivered & Completed POs
        completed_pos_list = db.query(PurchaseOrder).filter(
            PurchaseOrder.vendor_id == vid,
            PurchaseOrder.status.in_([POStatus.DELIVERED, POStatus.COMPLETED])
        ).all()
        delivered_pos = len(completed_pos_list)
        lifetime_fulfilled = sum(p.total_amount for p in completed_pos_list)

        # Delayed POs
        delayed_pos = db.query(PurchaseOrder).filter(
            PurchaseOrder.vendor_id == vid,
            PurchaseOrder.expected_delivery_date < today,
            PurchaseOrder.status.in_([POStatus.PENDING, POStatus.APPROVED, POStatus.ORDERED])
        ).count()

        # Invoices
        invoices = db.query(Invoice).join(PurchaseOrder).filter(
            PurchaseOrder.vendor_id == vid
        ).all()
        pending_invoices_list = [inv for inv in invoices if inv.status == InvoiceStatus.PENDING]
        paid_invoices_list = [inv for inv in invoices if inv.status == InvoiceStatus.PAID]
        pending_invoices = len(pending_invoices_list)
        paid_invoices = len(paid_invoices_list)
        total_invoiced_amount = sum(inv.amount for inv in invoices)
        pending_invoiced_amount = sum(inv.amount for inv in pending_invoices_list)
        paid_invoiced_amount = sum(inv.amount for inv in paid_invoices_list)

        active_contracts = db.query(Contract).filter(
            Contract.vendor_id == vid,
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON])
        ).count()
        certifications_count = db.query(Certification).filter(Certification.vendor_id == vid).count()
        unread_messages = db.query(Message).filter(
            Message.vendor_id == vid,
            Message.is_read == False,
            Message.sender_id != current_user.id
        ).count()

        # Top vendor performance metrics comparison
        top_5_vendors = db.query(Vendor).limit(5).all()
        vendor_performance_comparison = []
        for tv in top_5_vendors:
            tv_intel = compute_vendor_intelligence(tv, db)
            vendor_performance_comparison.append({
                "vendor": tv.company_name[:12],
                "delivery": round(tv_intel.get("on_time_delivery_rate", 90.0)),
                "quality": round(tv_intel.get("average_quality_rating", 4.5) * 20.0),
                "communication": round(max(50.0, 100.0 - (tv_intel.get("average_response_hours", 2.0) * 5.0))),
                "compliance": 95 if tv_intel.get("active_certifications", 0) >= 1 else 75
            })

        # Historical reliability trend
        reliability_trend = [
            {"month": m["month"], "score": round(m["on_time_rate"] * 0.9 + 10)}
            for m in intel.get("monthly_trend", [])
        ]
        if not reliability_trend:
            reliability_trend = [{"month": "Sep", "score": round(intel.get("reliability_score", 0.0))}]

        # Contract lifecycle distribution
        v_contracts = db.query(Contract).filter(Contract.vendor_id == vid).all()
        total_vc = max(1, len(v_contracts))
        c_active = sum(1 for c in v_contracts if c.status == ContractStatus.ACTIVE)
        c_expiring = sum(1 for c in v_contracts if c.status == ContractStatus.EXPIRING_SOON)
        c_expired = sum(1 for c in v_contracts if c.status == ContractStatus.EXPIRED)
        c_terminated = sum(1 for c in v_contracts if c.status == ContractStatus.TERMINATED)

        contract_status_donut = [
            {"name": "Active", "value": c_active, "pct": round(c_active / total_vc * 100), "color": "#10b981"},
            {"name": "Expiring Soon", "value": c_expiring, "pct": round(c_expiring / total_vc * 100), "color": "#f43f5e"},
            {"name": "Under Renewal", "value": c_terminated, "pct": round(c_terminated / total_vc * 100), "color": "#f59e0b"},
            {"name": "Expired", "value": c_expired, "pct": round(c_expired / total_vc * 100), "color": "#ea580c"}
        ]

        # Order history by month
        v_pos = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vid).all()
        v_order_months = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            v_order_months[m_key] = {"month": m_key, "value": 0.0, "orders": 0}
        
        for p in v_pos:
            m_key = p.created_at.strftime("%b") if p.created_at else "Sep"
            if m_key in v_order_months:
                v_order_months[m_key]["orders"] += 1
                v_order_months[m_key]["value"] = round(v_order_months[m_key]["value"] + (p.total_amount / 100000.0), 2)
            else:
                v_order_months[m_key] = {"month": m_key, "value": round(p.total_amount / 100000.0, 2), "orders": 1}
        order_history_chart = list(v_order_months.values())

        # Interaction channel distribution
        v_msgs = db.query(Message).filter(Message.vendor_id == vid).count()
        communication_activity_donut = [
            {"name": "Portal Messages", "value": max(1, v_msgs), "pct": 50, "color": "#0284c7"},
            {"name": "Discussions", "value": max(1, v_msgs // 2), "pct": 25, "color": "#10b981"},
            {"name": "Email Notices", "value": max(1, v_msgs // 3), "pct": 15, "color": "#ea580c"},
            {"name": "Support Queries", "value": max(1, v_msgs // 4), "pct": 10, "color": "#f43f5e"}
        ]

        return {
            "role": role.value,
            "vendor_info": {
                "id": vendor.id if vendor else None,
                "code": f"VND-{vendor.id:03d}" if vendor else "VND-001",
                "company_name": vendor.company_name if vendor else "N/A",
                "status": vendor.status.value if vendor else "N/A",
                "category": vendor.category.value if vendor else "N/A",
                "contact_person": vendor.contact_person if vendor else "N/A",
                "email": vendor.email if vendor else "N/A",
                "phone": vendor.phone if vendor and vendor.phone else "+91 98765 43210",
                "address": vendor.address if vendor and vendor.address else "Industrial Hub Park, Pune",
                "gst_number": vendor.gst_number if vendor and vendor.gst_number else "27AABCU9603R1ZM",
                "tier": intel.get("supplier_tier", "Tier 1: Preferred Supplier"),
                "risk_level": intel.get("risk_level", "Low")
            },
            "metrics": {
                "performance_score": intel.get("reliability_score", 0.0),
                "reliability_score": intel.get("reliability_score", 0.0),
                "risk_level": intel.get("risk_level", "Low"),
                "supplier_tier": intel.get("supplier_tier", "Tier 1: Preferred Supplier"),
                "on_time_delivery_rate": intel.get("on_time_delivery_rate", 100.0),
                "on_time_orders": intel.get("on_time_orders", delivered_pos),
                "total_orders": active_pos + delivered_pos,
                "average_quality_rating": intel.get("average_quality_rating", 4.8),
                "average_response_hours": intel.get("average_response_hours", 1.8),
                "issue_resolution_days": round(intel.get("issue_resolution_hours", 24.0) / 24.0, 1),
                "active_orders": active_pos,
                "active_commitment": round(active_commitment, 2),
                "delivered_orders": delivered_pos,
                "lifetime_fulfilled": round(lifetime_fulfilled, 2),
                "delayed_orders": delayed_pos,
                "disbursed_pending_amount": round(total_invoiced_amount, 2),
                "paid_invoices_count": paid_invoices,
                "pending_invoices_count": pending_invoices,
                "paid_invoices_amount": round(paid_invoiced_amount, 2),
                "pending_invoices_amount": round(pending_invoiced_amount, 2),
                "pending_invoices": pending_invoices,
                "active_contracts": len(v_contracts),
                "certifications_count": certifications_count,
                "unread_messages": unread_messages
            },
            "vendor_performance_comparison": vendor_performance_comparison,
            "reliability_trend": reliability_trend,
            "contract_status_donut": contract_status_donut,
            "order_history_chart": order_history_chart,
            "communication_activity_donut": communication_activity_donut
        }

    elif role == UserRole.FINANCE_OFFICER:
        all_invoices = db.query(Invoice).options(
            joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.vendor),
            joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.items)
        ).all()

        total_invoices_amount = sum(i.amount for i in all_invoices)
        pending_list = [i for i in all_invoices if i.status == InvoiceStatus.PENDING and i.due_date >= today]
        overdue_list = [i for i in all_invoices if i.status == InvoiceStatus.PENDING and i.due_date < today]
        paid_list = [i for i in all_invoices if i.status == InvoiceStatus.PAID]

        pending_amount = sum(i.amount for i in pending_list)
        overdue_amount = sum(i.amount for i in overdue_list)
        paid_amount = sum(i.amount for i in paid_list)

        total_inv_count = max(1, len(all_invoices))
        invoice_status_donut = [
            {"name": "Paid & Settled", "value": len(paid_list), "pct": round(len(paid_list) / total_inv_count * 100), "color": "#10b981", "amount": round(paid_amount, 2)},
            {"name": "Pending Verification", "value": len(pending_list), "pct": round(len(pending_list) / total_inv_count * 100), "color": "#0284c7", "amount": round(pending_amount, 2)},
            {"name": "Overdue", "value": len(overdue_list), "pct": round(len(overdue_list) / total_inv_count * 100), "color": "#ea580c", "amount": round(overdue_amount, 2)}
        ]

        # 6-Month Cash Flow Trend (Monthly Invoiced vs Disbursed/Paid in ₹ Lakh)
        f_months = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            f_months[m_key] = {"month": m_key, "invoiced": 0.0, "paid": 0.0, "invoices_count": 0}

        for inv in all_invoices:
            m_key = inv.created_at.strftime("%b") if inv.created_at else "Sep"
            if m_key in f_months:
                f_months[m_key]["invoices_count"] += 1
                f_months[m_key]["invoiced"] = round(f_months[m_key]["invoiced"] + (inv.amount / 100000.0), 2)
                if inv.status == InvoiceStatus.PAID:
                    f_months[m_key]["paid"] = round(f_months[m_key]["paid"] + (inv.amount / 100000.0), 2)
            else:
                f_months[m_key] = {
                    "month": m_key,
                    "invoiced": round(inv.amount / 100000.0, 2),
                    "paid": round(inv.amount / 100000.0, 2) if inv.status == InvoiceStatus.PAID else 0.0,
                    "invoices_count": 1
                }
        cashflow_trend = list(f_months.values())

        # Spend by Vendor Category
        cat_spend = {}
        for inv in all_invoices:
            if inv.purchase_order and inv.purchase_order.vendor:
                cat_lbl = inv.purchase_order.vendor.category.value.replace("_", " ").title()
            else:
                cat_lbl = "General Supplies"
            cat_spend[cat_lbl] = cat_spend.get(cat_lbl, 0.0) + inv.amount

        cat_total = max(1.0, sum(cat_spend.values()))
        palette = ["#0284c7", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"]
        spend_by_category = [
            {"name": k, "value": round(v / 100000.0, 2), "pct": round(v / cat_total * 100), "color": palette[idx % len(palette)]}
            for idx, (k, v) in enumerate(cat_spend.items())
        ]
        if not spend_by_category:
            spend_by_category = [{"name": "Raw Materials", "value": 0.0, "pct": 100, "color": "#0284c7"}]

        # Top 5 Suppliers by Financial Commitment
        vendor_spend = {}
        for inv in all_invoices:
            v_name = inv.purchase_order.vendor.company_name if inv.purchase_order and inv.purchase_order.vendor else "Supplier"
            if v_name not in vendor_spend:
                vendor_spend[v_name] = {"invoiced": 0.0, "paid": 0.0}
            vendor_spend[v_name]["invoiced"] += inv.amount
            if inv.status == InvoiceStatus.PAID:
                vendor_spend[v_name]["paid"] += inv.amount

        top_vendors_spend = [
            {
                "vendor": v[:14],
                "invoiced": round(s["invoiced"] / 100000.0, 2),
                "paid": round(s["paid"] / 100000.0, 2)
            }
            for v, s in sorted(vendor_spend.items(), key=lambda x: x[1]["invoiced"], reverse=True)[:5]
        ]

        recent_invoices = [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "po_number": i.purchase_order.po_number if i.purchase_order else "N/A",
                "vendor_name": i.purchase_order.vendor.company_name if i.purchase_order and i.purchase_order.vendor else "N/A",
                "amount": i.amount,
                "status": i.status.value,
                "due_date": str(i.due_date),
                "paid_date": str(i.paid_date) if i.paid_date else None,
                "purchase_order": {
                    "id": i.purchase_order.id,
                    "po_number": i.purchase_order.po_number,
                    "expected_delivery_date": str(i.purchase_order.expected_delivery_date),
                    "vendor": {
                        "company_name": i.purchase_order.vendor.company_name if i.purchase_order.vendor else "N/A",
                        "code": f"VND-{i.purchase_order.vendor.id:03d}" if i.purchase_order.vendor else "N/A",
                        "gst_number": i.purchase_order.vendor.gst_number if i.purchase_order.vendor else "N/A",
                        "email": i.purchase_order.vendor.email if i.purchase_order.vendor else "N/A",
                        "phone": i.purchase_order.vendor.phone if i.purchase_order.vendor else "N/A",
                        "address": i.purchase_order.vendor.address if i.purchase_order.vendor else "N/A"
                    } if i.purchase_order.vendor else None,
                    "items": [
                        {
                            "id": it.id,
                            "item_name": it.item_name,
                            "quantity": it.quantity,
                            "unit_price": it.unit_price
                        }
                        for it in i.purchase_order.items
                    ] if i.purchase_order.items else []
                } if i.purchase_order else None
            }
            for i in db.query(Invoice).order_by(Invoice.id.desc()).limit(8).all()
        ]

        return {
            "role": role.value,
            "metrics": {
                "total_invoiced": round(total_invoices_amount, 2),
                "pending_amount": round(pending_amount, 2),
                "paid_amount": round(paid_amount, 2),
                "overdue_amount": round(overdue_amount, 2),
                "pending_count": len(pending_list),
                "paid_count": len(paid_list),
                "overdue_count": len(overdue_list),
                "total_invoices_count": len(all_invoices)
            },
            "invoice_status_donut": invoice_status_donut,
            "cashflow_trend": cashflow_trend,
            "spend_by_category": spend_by_category,
            "top_vendors_spend": top_vendors_spend,
            "recent_invoices": recent_invoices
        }

    elif role == UserRole.AUDITOR:
        total_audit_logs = db.query(AuditLog).count()
        total_contracts = db.query(Contract).count()
        expiring_contracts = db.query(Contract).filter(
            Contract.end_date <= today + timedelta(days=30),
            Contract.status != ContractStatus.TERMINATED
        ).count()
        total_certs = db.query(Certification).count()
        expired_certs = db.query(Certification).filter(Certification.expiry_date < today).count()
        total_orders = db.query(PurchaseOrder).count()
        approved_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status != POStatus.PENDING).count()

        # Audit Log Event Action Distribution Donut
        all_logs = db.query(AuditLog).all()
        action_groups = {
            "Purchase Orders": sum(1 for l in all_logs if "PO" in l.action or l.entity == "PurchaseOrder"),
            "Invoices & Payments": sum(1 for l in all_logs if "INVOICE" in l.action or l.entity == "Invoice"),
            "User Access & Roles": sum(1 for l in all_logs if "ROLE" in l.action or "USER" in l.action or l.entity == "User"),
            "Contracts & Compliance": sum(1 for l in all_logs if "CONTRACT" in l.action or l.entity == "Contract"),
            "Communication & Email": sum(1 for l in all_logs if "EMAIL" in l.action or "MESSAGE" in l.action or l.entity == "Message")
        }
        total_act = max(1, sum(action_groups.values()))
        act_palette = ["#0284c7", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"]
        audit_events_donut = [
            {"name": k, "value": v, "pct": round(v / total_act * 100), "color": act_palette[idx % len(act_palette)]}
            for idx, (k, v) in enumerate(action_groups.items()) if v > 0
        ]
        if not audit_events_donut:
            audit_events_donut = [{"name": "System Activity", "value": total_audit_logs, "pct": 100, "color": "#0284c7"}]

        # Contract & Certification Compliance Health Donut
        active_c = db.query(Contract).filter(Contract.status == ContractStatus.ACTIVE).count()
        expiring_c = expiring_contracts
        expired_c = db.query(Contract).filter(Contract.status == ContractStatus.EXPIRED).count()
        valid_certs = max(0, total_certs - expired_certs)

        total_comp = max(1, active_c + expiring_c + expired_c + total_certs)
        compliance_status_donut = [
            {"name": "Valid & Compliant", "value": active_c + valid_certs, "pct": round((active_c + valid_certs) / total_comp * 100), "color": "#10b981"},
            {"name": "Expiring (< 30 Days)", "value": expiring_c, "pct": round(expiring_c / total_comp * 100), "color": "#f59e0b"},
            {"name": "Expired / Non-Compliant", "value": expired_c + expired_certs, "pct": round((expired_c + expired_certs) / total_comp * 100), "color": "#f43f5e"}
        ]

        # Organization-Wide Vendor Risk Distribution
        all_vendors = db.query(Vendor).all()
        risk_counts = {"Low Risk": 0, "Medium Risk": 0, "High Risk": 0}
        for v in all_vendors:
            v_intel = compute_vendor_intelligence(v, db)
            rl = v_intel.get("risk_level", "Low")
            if rl in ["Low"]:
                risk_counts["Low Risk"] += 1
            elif rl in ["Medium-Low", "Medium"]:
                risk_counts["Medium Risk"] += 1
            else:
                risk_counts["High Risk"] += 1

        total_r = max(1, sum(risk_counts.values()))
        system_risk_distribution = [
            {"name": "Low Risk (Tier 1)", "value": risk_counts["Low Risk"], "pct": round(risk_counts["Low Risk"] / total_r * 100), "color": "#10b981"},
            {"name": "Medium Risk (Tier 2/3)", "value": risk_counts["Medium Risk"], "pct": round(risk_counts["Medium Risk"] / total_r * 100), "color": "#0284c7"},
            {"name": "High Risk (Tier 4)", "value": risk_counts["High Risk"], "pct": round(risk_counts["High Risk"] / total_r * 100), "color": "#f43f5e"}
        ]

        # 6-Month Monthly Audit Log Activity Trend
        a_months = {}
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_key = m_date.strftime("%b")
            a_months[m_key] = {"month": m_key, "actions": 0, "events": 0}

        for l in all_logs:
            m_key = l.created_at.strftime("%b") if l.created_at else "Sep"
            if m_key in a_months:
                a_months[m_key]["actions"] += 1
                a_months[m_key]["events"] += 1
            else:
                a_months[m_key] = {"month": m_key, "actions": 1, "events": 1}
        monthly_audit_trend = list(a_months.values())

        recent_logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(10).all()

        return {
            "role": role.value,
            "metrics": {
                "total_audit_logs": total_audit_logs,
                "total_contracts": total_contracts,
                "expiring_soon_contracts": expiring_contracts,
                "total_certifications": total_certs,
                "expired_certifications": expired_certs,
                "total_purchase_orders": total_orders,
                "audited_orders": approved_pos,
                "compliance_score": round(((active_c + valid_certs) / total_comp) * 100)
            },
            "audit_events_donut": audit_events_donut,
            "compliance_status_donut": compliance_status_donut,
            "system_risk_distribution": system_risk_distribution,
            "monthly_audit_trend": monthly_audit_trend,
            "recent_logs": [
                {"id": l.id, "action": l.action, "entity": l.entity, "details": l.details, "created_at": l.created_at}
                for l in recent_logs
            ]
        }

    return {"role": role.value, "metrics": {}}
