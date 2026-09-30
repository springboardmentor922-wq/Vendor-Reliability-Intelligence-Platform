"""
views/approval_queue.py
------------------------
Dedicated Vendor Approval Queue page — Milestone 2.
Shows pending, recently approved, and recently rejected vendors.
Deep Navy + Warm Ivory + Muted Gold theme. Zero emoji.
"""

import streamlit as st
from datetime import datetime, timezone
from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import has_action_permission, ACTION_APPROVE_VENDOR
from services.vendor_service import (
    get_vendors_paginated,
    approve_vendor,
    reject_vendor,
    get_vendor_stats,
)


def _risk_pill(risk: str) -> str:
    COLORS = {
        "Low": ("#2D6A4A", "#EAF5F0"),
        "Moderate": ("#A67C32", "#FEF8E7"),
        "High": ("#8B3038", "#FDECEC"),
        "Critical": ("#6B1C1C", "#FDECEC"),
    }
    fg, bg = COLORS.get(risk, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{risk} Risk</span>'
    )


def _approval_status_pill(status: str) -> str:
    COLORS = {
        "Pending": ("#A67C32", "#FEF8E7"),
        "Approved": ("#2D6A4A", "#EAF5F0"),
        "Rejected": ("#8B3038", "#FDECEC"),
    }
    fg, bg = COLORS.get(status, ("#68707C", "#F1F3F5"))
    return (
        f'<span style="background:{bg};color:{fg};border:1px solid {fg}33;'
        f'border-radius:5px;padding:2px 8px;font-size:0.7rem;font-weight:700;">{status}</span>'
    )


def _format_date(dt) -> str:
    if not dt:
        return "N/A"
    if isinstance(dt, str):
        return dt[:10]
    try:
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "N/A"


def render_approval_queue_page() -> None:
    """Render the dedicated Vendor Approval Queue."""
    render_page_header(
        "Vendor Approval Queue",
        "Review and action pending vendor registrations. Approve qualified suppliers or reject with documented reason.",
    )

    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))
    can_approve = has_action_permission(role, ACTION_APPROVE_VENDOR)

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    stats = get_vendor_stats()
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #B08D57;'
            f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
            f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Pending Review</div>'
            f'<div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get("pending_approval", 0):,}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #2D6A4A;'
            f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
            f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Total Active</div>'
            f'<div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get("active", 0):,}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #172033;'
            f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
            f'<div style="font-size:0.7rem;color:#68707C;font-weight:700;text-transform:uppercase;">Total Suppliers</div>'
            f'<div style="font-size:1.65rem;font-weight:800;color:#20242A;margin-top:2px;">{stats.get("total", 0):,}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:0.75rem;'></div>", unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tabs = st.tabs(["Pending Approval", "Recently Approved", "Recently Rejected"])

    # ── Tab 1: Pending ────────────────────────────────────────────────────────
    with tabs[0]:
        pending_data = get_vendors_paginated(approval_status="Pending", page_size=50)
        pending = pending_data["items"]

        if not pending:
            render_empty_state(
                "Approval Queue Clear",
                "All vendor registrations have been reviewed. No pending approvals remain.",
            )
        else:
            render_section_header(
                f"Pending Vendor Approvals ({len(pending)} records)",
                "Review each vendor before approving or rejecting their registration",
            )

            for v in pending:
                v_id = str(v.get("_id", ""))
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat = v.get("category", "General")
                risk = "Low" if (v.get("reliability_score") or 0) >= 80 else "Moderate"
                rel = v.get("reliability_score") or 80.0
                tot = v.get("total_orders") or 0
                late_rate = (v.get("late_delivery_rate") or 0.0) * 100
                created = v.get("created_at")

                with st.expander(f"{sup_id}  |  {c_name}  |  {cat}"):
                    col_info, col_metrics, col_actions = st.columns([2.5, 2, 1.2])

                    with col_info:
                        st.markdown(
                            f'<div style="display:flex;gap:8px;margin-bottom:0.5rem;">'
                            f'{_risk_pill(risk)} {_approval_status_pill("Pending")}'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"**Supplier ID:** `{sup_id}`")
                        st.markdown(f"**Category:** {cat}")
                        contact = v.get("contact_information", {})
                        if contact.get("primary_email"):
                            st.markdown(f"**Email:** {contact['primary_email']}")
                        if contact.get("primary_contact_name"):
                            st.markdown(f"**Contact:** {contact['primary_contact_name']}")
                        addr = v.get("address", {})
                        loc = f"{addr.get('city', '')}, {addr.get('country', '')}".strip(", ")
                        if loc:
                            st.markdown(f"**Location:** {loc}")
                        st.markdown(f"**Submitted:** {_format_date(created)}")

                    with col_metrics:
                        st.markdown(
                            '<div style="font-size:0.75rem;font-weight:700;color:#68707C;text-transform:uppercase;margin-bottom:0.4rem;">DataCo Performance Metrics</div>',
                            unsafe_allow_html=True,
                        )
                        m1, m2 = st.columns(2)
                        with m1:
                            st.metric("Reliability", f"{rel:.1f}%")
                            st.metric("Total Orders", f"{tot:,}")
                        with m2:
                            st.metric("Late Delivery Rate", f"{late_rate:.1f}%")
                            avg_days = v.get("avg_shipping_days_real", 0.0) or 0.0
                            st.metric("Avg Transit", f"{avg_days:.1f}d")

                    with col_actions:
                        if can_approve:
                            if st.button(
                                "Approve Vendor",
                                key=f"appr_{v_id}",
                                type="primary",
                                use_container_width=True,
                            ):
                                ok, msg = approve_vendor(v_id, user_id)
                                if ok:
                                    st.success(msg)
                                    st.rerun()
                                else:
                                    st.error(msg)

                            reason = st.text_input(
                                "Rejection Reason",
                                placeholder="State reason...",
                                key=f"rej_reason_{v_id}",
                                label_visibility="collapsed",
                            )
                            st.caption("Enter rejection reason above")
                            if st.button(
                                "Reject Application",
                                key=f"rej_{v_id}",
                                use_container_width=True,
                            ):
                                ok, msg = reject_vendor(v_id, user_id, reason)
                                if ok:
                                    st.warning(msg)
                                    st.rerun()
                                else:
                                    st.error(msg)
                        else:
                            st.info("Read-only access. Contact an administrator to approve vendors.")

    # ── Tab 2: Recently Approved ──────────────────────────────────────────────
    with tabs[1]:
        approved_data = get_vendors_paginated(approval_status="Approved", page_size=30)
        approved = approved_data["items"]

        render_section_header(f"Recently Approved Vendors ({approved_data['total']:,} total)")

        if not approved:
            render_empty_state("No Approved Vendors", "No vendors have been approved yet.")
        else:
            for v in approved:
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat = v.get("category", "General")
                risk = v.get("risk_label", "Low")
                approved_by = v.get("approved_by", "System")
                updated = v.get("updated_at")

                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #2D6A4A;'
                    f'border-radius:8px;padding:0.7rem 1rem;margin-bottom:0.4rem;'
                    f'display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{sup_id} &bull; {cat} &bull; Approved by: {approved_by}</div>'
                    f'</div>'
                    f'<div style="display:flex;align-items:center;gap:0.5rem;">'
                    f'{_risk_pill(risk)} {_approval_status_pill("Approved")}'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    # ── Tab 3: Recently Rejected ──────────────────────────────────────────────
    with tabs[2]:
        rejected_data = get_vendors_paginated(approval_status="Rejected", page_size=30)
        rejected = rejected_data["items"]

        render_section_header(f"Rejected Applications ({rejected_data['total']:,} total)")

        if not rejected:
            render_empty_state("No Rejected Applications", "No vendor applications have been rejected.")
        else:
            for v in rejected:
                sup_id = v.get("supplier_id") or v.get("vendor_code", "N/A")
                c_name = v.get("company_name", f"Supplier {sup_id}")
                cat = v.get("category", "General")
                risk = v.get("risk_label", "High")
                rejected_by = v.get("rejected_by", "System")
                reason = v.get("rejection_reason", "Not specified")

                st.markdown(
                    f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid #8B3038;'
                    f'border-radius:8px;padding:0.7rem 1rem;margin-bottom:0.4rem;">'
                    f'<div style="display:flex;justify-content:space-between;align-items:center;">'
                    f'<div>'
                    f'<div style="font-size:0.87rem;font-weight:700;color:#20242A;">{c_name}</div>'
                    f'<div style="font-size:0.75rem;color:#68707C;">{sup_id} &bull; {cat} &bull; Rejected by: {rejected_by}</div>'
                    f'</div>'
                    f'{_approval_status_pill("Rejected")}'
                    f'</div>'
                    f'<div style="font-size:0.78rem;color:#8B3038;margin-top:0.35rem;background:#FDECEC;'
                    f'border-radius:5px;padding:0.3rem 0.6rem;">Reason: {reason}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
