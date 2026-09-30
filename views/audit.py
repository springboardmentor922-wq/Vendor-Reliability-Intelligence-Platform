"""
views/audit.py
--------------
Auditor View — Milestone 3. Read-only access to all platform data.

Accessible to: Auditor role and Administrator role.

Four tabs:
  1. Audit Trail          — Full immutable log from audit_logs collection;
                            columns: user, role, action, entity, record ID, timestamp.
                            Search by user/action/entity. Date range filter. Export CSV.
  2. Transaction Review   — Read-only views of PRs, POs, invoices, vendor approvals.
  3. Message Audit        — Read-only access to all communication threads.
  4. System Events        — Login events, permission changes, system-level actions.

All data is immutable — no edit/delete controls rendered.
Complete audit trail via existing audit_logs collection + log_audit() utility.
Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.
"""

import streamlit as st
import pandas as pd
from datetime import datetime, timezone, timedelta

from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_VIEW_AUDIT_TRAIL,
    ROLE_AUDITOR,
    ROLE_ADMINISTRATOR,
)
from database.connection import get_database
from config.settings import (
    COLLECTION_AUDIT_LOGS,
    COLLECTION_PROCUREMENT_REQUESTS,
    COLLECTION_PURCHASE_ORDERS,
    COLLECTION_INVOICES,
    COLLECTION_VENDORS,
)
from services.cache_service import get_cached_audit_kpis
from services.communication_service import get_messages_for_auditor, get_message_count_for_auditor
from services.procurement_service import get_procurement_requests, get_purchase_orders


def _format_dt(dt) -> str:
    if not dt:
        return "—"
    if isinstance(dt, str):
        return dt[:19]
    try:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except Exception:
        return str(dt)[:19]


def _permission_guard() -> bool:
    role = get_current_role()
    if role not in (ROLE_AUDITOR, ROLE_ADMINISTRATOR):
        st.error("Access denied. This page requires Auditor or Administrator role.")
        return False
    return True


def render_audit_page() -> None:
    """Render the Audit Trail & Compliance View."""
    if not _permission_guard():
        return

    render_page_header(
        "Audit Trail & Compliance",
        "Immutable record of all platform transactions, approvals, vendor actions, messages, and system events.",
    )

    role = get_current_role()
    is_admin = role == ROLE_ADMINISTRATOR

    # Readonly banner
    st.markdown(
        f'<div style="background:#F7F5F0;border:1px solid #D9D6CF;border-left:4px solid #172033;'
        f'border-radius:8px;padding:0.6rem 1rem;margin-bottom:1rem;color:#526174;font-size:0.85rem;">'
        f'<strong style="color:#172033;">Read-Only Audit View</strong> — All records are immutable. '
        f'{"Administrator access — full read-only audit view." if is_admin else "Auditor access — all platform data visible, no modifications permitted."}'
        f'</div>',
        unsafe_allow_html=True,
    )

    # Summary KPIs — single $facet aggregate via cache (TTL 2 min)
    kpis = get_cached_audit_kpis()
    total_events = kpis["total_events"]
    today_events = kpis["today_events"]
    unique_users = kpis["unique_users"]
    unique_actions = kpis["unique_actions"]

    c1, c2, c3, c4 = st.columns(4)
    for col, label, val, color in [
        (c1, "Total Audit Events", f"{total_events:,}", "#172033"),
        (c2, "Events Today", f"{today_events:,}", "#2D6A4A"),
        (c3, "Unique Users Tracked", f"{unique_users:,}", "#2E4B7A"),
        (c4, "Action Types", f"{unique_actions:,}", "#B08D57"),
    ]:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
                f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{val}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.markdown("<div style='height:0.6rem;'></div>", unsafe_allow_html=True)

    tabs = st.tabs(["Audit Trail", "Transaction Review", "Message Audit", "System Events"])

    with tabs[0]:
        _render_audit_trail_tab()
    with tabs[1]:
        _render_transaction_review_tab()
    with tabs[2]:
        _render_message_audit_tab()
    with tabs[3]:
        _render_system_events_tab()


# ── Tab 1: Audit Trail ────────────────────────────────────────────────────────

def _render_audit_trail_tab() -> None:
    render_section_header("Complete Audit Trail", "Immutable log — user, role, action, entity, record ID, timestamp")

    # Filters
    f1, f2, f3, f4, f5 = st.columns([2, 2, 2, 1.5, 1.5])
    with f1:
        search_user = st.text_input("Filter by User ID", placeholder="User ID or partial...", key="audit_user_f")
    with f2:
        search_action = st.text_input("Filter by Action", placeholder="e.g. APPROVE_PR...", key="audit_action_f")
    with f3:
        search_entity = st.text_input("Filter by Entity", placeholder="e.g. Vendor...", key="audit_entity_f")
    with f4:
        date_from = st.date_input("From Date", value=None, key="audit_date_from")
    with f5:
        date_to = st.date_input("To Date", value=None, key="audit_date_to")

    if "audit_page" not in st.session_state:
        st.session_state["audit_page"] = 1

    if st.button("Reset Filters", key="audit_reset"):
        st.session_state["audit_page"] = 1
        st.rerun()

    # Build query
    try:
        db = get_database()
        audit_col = db[COLLECTION_AUDIT_LOGS]
        query = {}
        if search_user.strip():
            query["user_id"] = {"$regex": search_user.strip(), "$options": "i"}
        if search_action.strip():
            query["action"] = {"$regex": search_action.strip(), "$options": "i"}
        if search_entity.strip():
            query["entity"] = {"$regex": search_entity.strip(), "$options": "i"}
        if date_from:
            query.setdefault("timestamp", {})["$gte"] = datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        if date_to:
            query.setdefault("timestamp", {})["$lte"] = datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)

        page_size = 25
        total = audit_col.count_documents(query)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = max(1, min(st.session_state["audit_page"], total_pages))
        skip = (page - 1) * page_size

        docs = list(
            audit_col.find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(page_size)
        )
    except Exception as exc:
        st.error(f"Could not load audit log: {exc}")
        return

    if not docs:
        render_empty_state("No Audit Records", "No events match the current filter criteria.")
        return

    # Table
    rows = []
    for d in docs:
        rows.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;">'
            f'<td style="padding:0.5rem 0.65rem;font-family:monospace;font-size:0.75rem;color:#68707C;">{str(d.get("user_id",""))[:16]}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-weight:700;color:#172033;font-size:0.8rem;">{d.get("action","")}</td>'
            f'<td style="padding:0.5rem 0.65rem;color:#20242A;font-size:0.8rem;">{d.get("entity","")}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-family:monospace;font-size:0.73rem;color:#526174;">{str(d.get("entity_id",""))[:18]}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.73rem;color:#68707C;">{_format_dt(d.get("timestamp"))}</td>'
            f'</tr>'
        )

    tbl = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
        'max-height:500px;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;position:sticky;top:0;">'
        '<th style="padding:0.6rem 0.65rem;">User ID</th>'
        '<th style="padding:0.6rem 0.65rem;">Action</th>'
        '<th style="padding:0.6rem 0.65rem;">Entity</th>'
        '<th style="padding:0.6rem 0.65rem;">Record ID</th>'
        '<th style="padding:0.6rem 0.65rem;">Timestamp (UTC)</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody>'
        '</table></div>'
    )
    st.markdown(tbl, unsafe_allow_html=True)

    # Pagination
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    p1, p2, p3, p4 = st.columns([1, 3, 1, 2])
    with p1:
        if page > 1:
            if st.button("Previous", key="audit_prev"):
                st.session_state["audit_page"] -= 1
                st.rerun()
    with p2:
        st.markdown(
            f'<div style="text-align:center;color:#68707C;font-size:0.82rem;padding-top:0.5rem;">'
            f'Page {page} of {total_pages} — {total:,} events</div>',
            unsafe_allow_html=True,
        )
    with p3:
        if page < total_pages:
            if st.button("Next", key="audit_next"):
                st.session_state["audit_page"] += 1
                st.rerun()
    with p4:
        # Export
        try:
            all_docs = list(audit_col.find(query).sort("timestamp", -1).limit(1000))
            export_rows = [
                {
                    "User_ID": str(d.get("user_id", "")),
                    "Action": d.get("action", ""),
                    "Entity": d.get("entity", ""),
                    "Record_ID": str(d.get("entity_id", "")),
                    "Timestamp_UTC": _format_dt(d.get("timestamp")),
                    "Details": str(d.get("details", "")),
                }
                for d in all_docs
            ]
            df_export = pd.DataFrame(export_rows)
            csv = df_export.to_csv(index=False).encode("utf-8")
            st.download_button(
                "Export CSV",
                data=csv,
                file_name=f"VendorPulse_AuditTrail_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
                mime="text/csv",
                use_container_width=True,
            )
        except Exception:
            pass


# ── Tab 2: Transaction Review ─────────────────────────────────────────────────

def _render_transaction_review_tab() -> None:
    render_section_header("Transaction Review", "Read-only access to all procurement transactions")

    tx_type = st.radio(
        "Record type",
        ["Procurement Requests", "Purchase Orders", "Vendor Approvals"],
        horizontal=True,
        key="audit_tx_type",
    )

    if tx_type == "Procurement Requests":
        prs = get_procurement_requests()
        if not prs:
            render_empty_state("No Records", "No procurement requests found.")
            return
        rows = []
        for pr in prs[:100]:
            rows.append({
                "Request No.": pr.get("request_number", ""),
                "Department": pr.get("department", ""),
                "Priority": pr.get("priority", ""),
                "Status": pr.get("status", ""),
                "Estimated Cost": f"${pr.get('estimated_cost', 0):,.2f}",
                "Requested By": str(pr.get("requested_by", ""))[:16],
                "Created At": _format_dt(pr.get("created_at")),
                "Vendor Assigned": pr.get("assigned_vendor_id", "None"),
            })
        df = pd.DataFrame(rows)
        st.dataframe(df, use_container_width=True, hide_index=True)
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button("Export CSV", data=csv,
                           file_name="VendorPulse_ProcurementRequests.csv", mime="text/csv")

    elif tx_type == "Purchase Orders":
        pos = get_purchase_orders()
        if not pos:
            render_empty_state("No Records", "No purchase orders found.")
            return
        rows = []
        for po in pos[:100]:
            rows.append({
                "PO Number": po.get("po_number", ""),
                "Status": po.get("status", ""),
                "Vendor ID": str(po.get("vendor_id", ""))[:16],
                "Amount": f"${po.get('total_amount', 0):,.2f}",
                "Compliance": "Yes" if po.get("compliance") else "No",
                "Defective Units": po.get("defective_units", 0),
                "Created By": str(po.get("created_by", ""))[:16],
                "Created At": _format_dt(po.get("created_at")),
            })
        df = pd.DataFrame(rows)
        st.dataframe(df, use_container_width=True, hide_index=True)
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button("Export CSV", data=csv,
                           file_name="VendorPulse_PurchaseOrders.csv", mime="text/csv")

    elif tx_type == "Vendor Approvals":
        try:
            db = get_database()
            vendors = list(
                db[COLLECTION_VENDORS].find(
                    {"approval_status": {"$in": ["Approved", "Rejected"]}},
                    {"vendor_code": 1, "company_name": 1, "approval_status": 1,
                     "approved_by": 1, "rejected_by": 1, "updated_at": 1, "status": 1}
                ).sort("updated_at", -1).limit(100)
            )
            if not vendors:
                render_empty_state("No Records", "No approval decisions recorded.")
                return
            rows = []
            for v in vendors:
                rows.append({
                    "Vendor Code": v.get("vendor_code", ""),
                    "Company": v.get("company_name", ""),
                    "Decision": v.get("approval_status", ""),
                    "Status": v.get("status", ""),
                    "Approved By": str(v.get("approved_by", v.get("rejected_by", "—")))[:16],
                    "Decision Date": _format_dt(v.get("updated_at")),
                })
            df = pd.DataFrame(rows)
            st.dataframe(df, use_container_width=True, hide_index=True)
            csv = df.to_csv(index=False).encode("utf-8")
            st.download_button("Export CSV", data=csv,
                               file_name="VendorPulse_VendorApprovals.csv", mime="text/csv")
        except Exception as exc:
            st.error(f"Could not load vendor approvals: {exc}")


# ── Tab 3: Message Audit ──────────────────────────────────────────────────────

def _render_message_audit_tab() -> None:
    render_section_header("Communication Audit", "Read-only access to all platform messages and threads")

    # Filter
    t_filter = st.radio(
        "Thread Type",
        ["All", "vendor", "procurement", "purchase_order", "general"],
        horizontal=True,
        key="audit_msg_type",
    )
    thread_type_param = None if t_filter == "All" else t_filter

    if "msg_audit_page" not in st.session_state:
        st.session_state["msg_audit_page"] = 1

    page_size = 30
    total_msgs = get_message_count_for_auditor(thread_type_param)
    total_pages = max(1, (total_msgs + page_size - 1) // page_size)
    page = max(1, min(st.session_state["msg_audit_page"], total_pages))
    skip = (page - 1) * page_size

    messages = get_messages_for_auditor(
        thread_type=thread_type_param,
        limit=page_size,
        skip=skip,
    )

    if not messages:
        render_empty_state("No Messages", "No communication records found.")
        return

    # Table
    rows = []
    for m in messages:
        deleted = m.get("is_deleted", False)
        rows.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;{"opacity:0.5;" if deleted else ""}">'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.8rem;color:#172033;font-weight:600;">'
            f'{m.get("sender_name","")}'
            f'{"<span style=font-size:0.67rem;color:#68707C;margin-left:4px;>[" + m.get("sender_role","") + "]</span>" if m.get("sender_role") else ""}'
            f'</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.75rem;color:#2E4B7A;">{m.get("thread_type","")}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.75rem;color:#68707C;">{m.get("thread_label","")[:20]}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.8rem;color:#20242A;">{m.get("content","")[:60]}{"..." if len(m.get("content","")) > 60 else ""}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.72rem;color:#68707C;">{_format_dt(m.get("created_at"))}</td>'
            f'<td style="padding:0.5rem 0.65rem;text-align:center;font-size:0.72rem;color:{"#8B3038" if deleted else "#2D6A4A"};font-weight:700;">{"Deleted" if deleted else "Active"}</td>'
            f'</tr>'
        )

    tbl = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
        'max-height:500px;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;position:sticky;top:0;">'
        '<th style="padding:0.6rem 0.65rem;">Sender / Role</th>'
        '<th style="padding:0.6rem 0.65rem;">Thread Type</th>'
        '<th style="padding:0.6rem 0.65rem;">Thread</th>'
        '<th style="padding:0.6rem 0.65rem;">Message Preview</th>'
        '<th style="padding:0.6rem 0.65rem;">Timestamp (UTC)</th>'
        '<th style="padding:0.6rem 0.65rem;text-align:center;">Status</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody>'
        '</table></div>'
    )
    st.markdown(tbl, unsafe_allow_html=True)

    # Pagination
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    mp1, mp2, mp3 = st.columns([1, 3, 1])
    with mp1:
        if page > 1:
            if st.button("Previous", key="msg_audit_prev"):
                st.session_state["msg_audit_page"] -= 1
                st.rerun()
    with mp2:
        st.markdown(
            f'<div style="text-align:center;color:#68707C;font-size:0.82rem;padding-top:0.5rem;">'
            f'Page {page} of {total_pages} — {total_msgs:,} messages</div>',
            unsafe_allow_html=True,
        )
    with mp3:
        if page < total_pages:
            if st.button("Next", key="msg_audit_next"):
                st.session_state["msg_audit_page"] += 1
                st.rerun()


# ── Tab 4: System Events ──────────────────────────────────────────────────────

def _render_system_events_tab() -> None:
    render_section_header("System Events", "Login events, permission-level actions, and system configuration changes")

    system_actions = [
        "LOGIN", "LOGOUT", "REGISTER", "UPDATE_PASSWORD",
        "APPROVE_VENDOR", "REJECT_VENDOR",
        "APPROVE_PR", "REJECT_PR",
        "APPROVE_PO",
        "DELETE_VENDOR", "UPDATE_VENDOR_STATUS",
        "SYSTEM_CONFIG",
    ]

    action_filter = st.selectbox(
        "Filter System Action",
        ["All System Events"] + system_actions,
        key="sys_event_filter",
    )

    try:
        db = get_database()
        audit_col = db[COLLECTION_AUDIT_LOGS]

        query = {}
        if action_filter != "All System Events":
            query["action"] = action_filter
        else:
            # Show only high-level system events
            query["action"] = {"$in": system_actions}

        docs = list(
            audit_col.find(query)
            .sort("timestamp", -1)
            .limit(100)
        )
    except Exception as exc:
        st.error(f"Could not load system events: {exc}")
        return

    if not docs:
        render_empty_state("No System Events", "No matching system events recorded yet.")
        return

    rows = []
    for d in docs:
        action = d.get("action", "")
        action_colors = {
            "LOGIN": "#2D6A4A", "LOGOUT": "#68707C",
            "REGISTER": "#2E4B7A",
            "APPROVE_VENDOR": "#2D6A4A", "REJECT_VENDOR": "#8B3038",
            "APPROVE_PR": "#2D6A4A", "REJECT_PR": "#8B3038",
            "APPROVE_PO": "#2D6A4A",
            "DELETE_VENDOR": "#8B3038", "UPDATE_VENDOR_STATUS": "#B08D57",
        }
        a_color = action_colors.get(action, "#172033")

        rows.append(
            f'<tr style="border-bottom:1px solid #E5E2DC;">'
            f'<td style="padding:0.5rem 0.65rem;font-family:monospace;font-size:0.75rem;color:#526174;">{str(d.get("user_id",""))[:16]}</td>'
            f'<td style="padding:0.5rem 0.65rem;">'
            f'<span style="background:#F7F5F0;color:{a_color};border:1px solid {a_color};'
            f'border-radius:4px;padding:2px 7px;font-size:0.7rem;font-weight:700;">{action}</span>'
            f'</td>'
            f'<td style="padding:0.5rem 0.65rem;color:#68707C;font-size:0.78rem;">{d.get("entity","")}</td>'
            f'<td style="padding:0.5rem 0.65rem;font-size:0.73rem;color:#68707C;">{_format_dt(d.get("timestamp"))}</td>'
            f'</tr>'
        )

    tbl = (
        '<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-radius:10px;overflow:auto;'
        'max-height:480px;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
        '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">'
        '<thead><tr style="background:#172033;color:#FFFFFF;position:sticky;top:0;">'
        '<th style="padding:0.6rem 0.65rem;">User ID</th>'
        '<th style="padding:0.6rem 0.65rem;">Action</th>'
        '<th style="padding:0.6rem 0.65rem;">Entity</th>'
        '<th style="padding:0.6rem 0.65rem;">Timestamp (UTC)</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody>'
        '</table></div>'
    )
    st.markdown(tbl, unsafe_allow_html=True)

    # Export
    st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
    try:
        export_rows = [
            {
                "User_ID": str(d.get("user_id", "")),
                "Action": d.get("action", ""),
                "Entity": d.get("entity", ""),
                "Record_ID": str(d.get("entity_id", "")),
                "Timestamp_UTC": _format_dt(d.get("timestamp")),
            }
            for d in docs
        ]
        df_exp = pd.DataFrame(export_rows)
        csv = df_exp.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Export System Events CSV",
            data=csv,
            file_name=f"VendorPulse_SystemEvents_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )
    except Exception:
        pass
