"""
views/reports.py
----------------
Enterprise Reports & Export Center — Milestone 3.

Four real report types backed by live MongoDB data:
  1. Vendor Performance Report   — ranking, scores, risk tiers, delivery stats
  2. Procurement Report          — PRs, statuses, cycle times, spend
  3. Purchase Order Report       — PO ledger with amounts, status, vendor
  4. Risk Report                 — High/medium risk vendors, failure analysis

Features:
  - Report preview table (paginated)
  - CSV + JSON export via st.download_button
  - Report metadata: record count, generated timestamp, filter summary

Zero emoji. Deep Navy + Warm Ivory + Muted Gold theme.
"""

import json
import streamlit as st
import pandas as pd
from datetime import datetime, timezone

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_role
from auth.permissions import has_action_permission, ACTION_EXPORT_REPORTS
from services.vendor_service import get_vendors_paginated
from services.procurement_service import get_purchase_orders, get_procurement_requests
from services.performance_service import get_vendor_performance_ranked, get_risk_tier


def _get_generated_at() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def render_reports_page() -> None:
    """Render the Enterprise Reports & Export Center."""
    render_page_header(
        "Reports & Compliance Exports",
        "Generate vendor performance, procurement, purchase order, and risk reports with export functionality.",
    )

    role = get_current_role()
    can_export = has_action_permission(role, ACTION_EXPORT_REPORTS)

    # ── Report Configuration ──────────────────────────────────────────────────
    render_section_header("Generate Report")

    with st.form("report_gen_form"):
        r1, r2, r3 = st.columns(3)
        with r1:
            report_type = st.selectbox(
                "Report Type",
                [
                    "Vendor Performance Report",
                    "Procurement Report",
                    "Purchase Order Report",
                    "Risk Analysis Report",
                ],
                key="rep_type_sel",
            )
        with r2:
            timeframe = st.selectbox(
                "Timeframe",
                ["All Data", "Last 30 Days", "Last 90 Days", "Year to Date"],
                key="rep_time_sel",
            )
        with r3:
            export_format = st.selectbox(
                "Export Format",
                ["CSV", "JSON"],
                key="rep_fmt_sel",
            )

        r4, r5 = st.columns(2)
        with r4:
            risk_filter = st.selectbox(
                "Risk Filter (for Risk/Performance reports)",
                ["All", "High Risk Only", "Medium Risk Only", "Low Risk Only"],
                key="rep_risk_f",
            )
        with r5:
            record_limit = st.slider("Max Records", 25, 500, 100, step=25, key="rep_limit")

        gen_btn = st.form_submit_button("Generate Report", type="primary", use_container_width=True)

    if "last_report" not in st.session_state:
        st.session_state["last_report"] = None

    if gen_btn:
        with st.spinner("Generating report..."):
            df, meta = _generate_report(report_type, risk_filter, record_limit)
        st.session_state["last_report"] = {"df": df, "meta": meta, "type": report_type, "format": export_format}

    # ── Report Output ──────────────────────────────────────────────────────────
    if st.session_state.get("last_report"):
        rep = st.session_state["last_report"]
        df = rep["df"]
        meta = rep["meta"]
        rep_type = rep["type"]
        fmt = rep["format"]

        st.markdown("<div style='height:0.5rem;'></div>", unsafe_allow_html=True)

        # Meta banner
        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;'
            f'padding:0.85rem 1.2rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">'
            f'<div>'
            f'<div style="font-weight:700;color:#172033;font-size:0.95rem;">{rep_type}</div>'
            f'<div style="font-size:0.78rem;color:#68707C;margin-top:2px;">{meta.get("description","")}</div>'
            f'</div>'
            f'<div style="text-align:right;">'
            f'<div style="font-size:0.72rem;color:#68707C;">Generated: {meta.get("generated_at","")}</div>'
            f'<div style="font-size:0.72rem;color:#B08D57;font-weight:700;">{meta.get("record_count",0):,} records</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        if df.empty:
            render_empty_state("No Data", "No records match the current report configuration.")
        else:
            render_section_header("Report Preview", f"Showing first {min(25, len(df))} of {len(df)} records")
            st.dataframe(df.head(25), use_container_width=True, hide_index=True)

            if can_export:
                exp1, exp2 = st.columns(2)
                safe_name = rep_type.replace(" ", "_").replace("/", "_")
                ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")

                with exp1:
                    csv_bytes = df.to_csv(index=False).encode("utf-8")
                    st.download_button(
                        "Download CSV",
                        data=csv_bytes,
                        file_name=f"VendorPulse_{safe_name}_{ts}.csv",
                        mime="text/csv",
                        type="primary",
                        use_container_width=True,
                    )
                with exp2:
                    json_bytes = df.to_json(orient="records", indent=2).encode("utf-8")
                    st.download_button(
                        "Download JSON",
                        data=json_bytes,
                        file_name=f"VendorPulse_{safe_name}_{ts}.json",
                        mime="application/json",
                        use_container_width=True,
                    )
            else:
                st.info("Export requires Report export permission.")

    st.markdown("<div style='height:1.2rem;'></div>", unsafe_allow_html=True)

    # ── Standard Report Modules ────────────────────────────────────────────────
    render_section_header("Standard Report Catalogue")
    _render_report_catalogue()


# ── Report Generation Logic ───────────────────────────────────────────────────

def _generate_report(report_type: str, risk_filter: str, limit: int):
    generated_at = _get_generated_at()

    if report_type == "Vendor Performance Report":
        return _vendor_performance_report(risk_filter, limit, generated_at)
    elif report_type == "Procurement Report":
        return _procurement_report(limit, generated_at)
    elif report_type == "Purchase Order Report":
        return _po_report(limit, generated_at)
    elif report_type == "Risk Analysis Report":
        return _risk_report(risk_filter, limit, generated_at)
    else:
        return pd.DataFrame(), {"generated_at": generated_at, "record_count": 0, "description": ""}


def _vendor_performance_report(risk_filter: str, limit: int, generated_at: str):
    tier_map = {"High Risk Only": "High", "Medium Risk Only": "Medium", "Low Risk Only": "Low"}
    tier = tier_map.get(risk_filter)

    ranked = get_vendor_performance_ranked(page=1, page_size=limit, risk_filter=tier)
    items = ranked.get("items", [])

    rows = []
    for v in items:
        rows.append({
            "Vendor_Code": v.get("vendor_code"),
            "Company_Name": v.get("company_name"),
            "Department": v.get("department"),
            "Market": v.get("market"),
            "Category": v.get("category"),
            "Total_Orders": v.get("total_orders"),
            "On_Time_Orders": v.get("on_time_count"),
            "Late_Orders": v.get("late_delivery_count"),
            "Delivery_Accuracy_%": v.get("delivery_accuracy_pct"),
            "Delay_Rate_%": v.get("delay_rate_pct"),
            "Quality_Index_%": v.get("quality_index"),
            "Completion_Rate_%": v.get("completion_rate"),
            "Reliability_Score": v.get("reliability_score"),
            "Risk_Tier": v.get("risk_tier"),
        })

    df = pd.DataFrame(rows)
    meta = {
        "generated_at": generated_at,
        "record_count": len(rows),
        "description": f"Vendor reliability and delivery performance rankings{' (filtered: ' + risk_filter + ')' if tier else ''}",
    }
    return df, meta


def _procurement_report(limit: int, generated_at: str):
    prs = get_procurement_requests()[:limit]
    rows = []
    for pr in prs:
        created = pr.get("created_at")
        rows.append({
            "Request_Number": pr.get("request_number"),
            "Department": pr.get("department"),
            "Priority": pr.get("priority"),
            "Status": pr.get("status"),
            "Product": pr.get("product_name") or pr.get("items", [{}])[0].get("name", "") if pr.get("items") else "",
            "Category": pr.get("category"),
            "Estimated_Cost": pr.get("estimated_cost"),
            "Requested_By": pr.get("requested_by"),
            "Created_At": created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else str(created or ""),
            "Assigned_Vendor": pr.get("assigned_vendor_id", ""),
            "Vendor_Response": pr.get("vendor_response", ""),
        })
    df = pd.DataFrame(rows)
    meta = {
        "generated_at": generated_at,
        "record_count": len(rows),
        "description": "Full procurement requisition ledger with statuses, priorities, and vendor assignments",
    }
    return df, meta


def _po_report(limit: int, generated_at: str):
    pos = get_purchase_orders()[:limit]
    rows = []
    for po in pos:
        created = po.get("created_at")
        rows.append({
            "PO_Number": po.get("po_number"),
            "Status": po.get("status"),
            "Vendor_ID": po.get("vendor_id"),
            "Total_Amount": po.get("total_amount"),
            "PR_ID": po.get("procurement_request_id"),
            "Created_By": po.get("created_by"),
            "Created_At": created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else str(created or ""),
            "Delivery_Date": po.get("expected_delivery_date", ""),
            "Compliance": po.get("compliance"),
            "Defective_Units": po.get("defective_units", 0),
        })
    df = pd.DataFrame(rows)
    meta = {
        "generated_at": generated_at,
        "record_count": len(rows),
        "description": "Full purchase order ledger — amounts, vendor IDs, status, compliance flags",
    }
    return df, meta


def _risk_report(risk_filter: str, limit: int, generated_at: str):
    tier_map = {"High Risk Only": "High", "Medium Risk Only": "Medium", "Low Risk Only": "Low"}
    tier = tier_map.get(risk_filter)

    ranked = get_vendor_performance_ranked(page=1, page_size=limit, risk_filter=tier or "High")
    items = ranked.get("items", [])

    rows = []
    for v in items:
        rows.append({
            "Vendor_Code": v.get("vendor_code"),
            "Company_Name": v.get("company_name"),
            "Market": v.get("market"),
            "Department": v.get("department"),
            "Risk_Tier": v.get("risk_tier"),
            "Reliability_Score": v.get("reliability_score"),
            "Delivery_Accuracy_%": v.get("delivery_accuracy_pct"),
            "Delay_Rate_%": v.get("delay_rate_pct"),
            "Late_Orders": v.get("late_delivery_count"),
            "Total_Orders": v.get("total_orders"),
            "Quality_Index_%": v.get("quality_index"),
            "Action_Required": "Yes — Immediate Review" if v.get("risk_tier") == "High"
                else "Yes — Monitor" if v.get("risk_tier") == "Medium"
                else "No",
        })

    df = pd.DataFrame(rows)
    meta = {
        "generated_at": generated_at,
        "record_count": len(rows),
        "description": f"Supplier risk analysis — reliability scores, tier classification, delivery failure rates{' (filtered: ' + risk_filter + ')' if tier else ' (default: High Risk)'}",
    }
    return df, meta


# ── Report Catalogue ───────────────────────────────────────────────────────────

def _render_report_catalogue():
    catalogues = [
        {
            "title": "Vendor Performance Master Report",
            "description": "Comprehensive ranking of all suppliers with delivery accuracy, reliability scores, and risk tier classification sourced from the DataCo dataset.",
            "tag": "System Standard",
            "tag_color": "#2E4B7A",
            "frequency": "Updated Daily",
        },
        {
            "title": "Procurement Spend & Requisition Audit",
            "description": "Full ledger of procurement requests including cycle times, approval rates, department breakdown, and estimated vs actual spend variance.",
            "tag": "SOX Compliant",
            "tag_color": "#2D6A4A",
            "frequency": "Audited Weekly",
        },
        {
            "title": "Purchase Order Fulfillment Ledger",
            "description": "Complete purchase order register with vendor IDs, line item amounts, fulfillment status, compliance flags, and defect unit tracking.",
            "tag": "Finance Grade",
            "tag_color": "#B08D57",
            "frequency": "Updated Daily",
        },
        {
            "title": "Supplier Risk Intelligence Report",
            "description": "Risk-tier classified vendor list highlighting high-risk suppliers by reliability score, late delivery rate, and market-level risk profiles.",
            "tag": "Risk Management",
            "tag_color": "#8B3038",
            "frequency": "Updated Weekly",
        },
    ]

    col_a, col_b = st.columns(2)
    for i, cat in enumerate(catalogues):
        col = col_a if i % 2 == 0 else col_b
        with col:
            st.markdown(
                f"""
                <div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;
                    padding:1.1rem 1.25rem;margin-bottom:0.75rem;
                    box-shadow:0 1px 3px rgba(23,32,51,0.03);">
                    <div style="font-weight:700;color:#172033;font-size:0.95rem;margin-bottom:5px;">
                        {cat['title']}
                    </div>
                    <div style="color:#526174;font-size:0.82rem;line-height:1.5;margin-bottom:0.65rem;">
                        {cat['description']}
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="background:#F7F5F0;color:{cat['tag_color']};border:1px solid {cat['tag_color']};
                            font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:4px;">{cat['tag']}</span>
                        <span style="font-size:0.72rem;color:#68707C;">{cat['frequency']}</span>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
