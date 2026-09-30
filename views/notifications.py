"""
views/notifications.py
----------------------
Enterprise Notification & Alert Center — Milestone 3.

7 notification types with distinct icons, colors and filtering:
  procurement_approval  — PR workflow events
  vendor_assignment     — Vendor assign / accept / reject
  po_update             — PO created, approved, delivered
  delivery_delay        — Delivery late alerts
  performance_alert     — Poor performance / high risk
  compliance_alert      — Contract / compliance issues
  invoice_verification  — Invoice verified / discrepancy

Features:
  - Type filter + unread-only toggle
  - In-app read/unread with dot indicator and count
  - Mark single / mark all read
  - Unread count badge per type

Zero emoji. Deep Navy + Warm Ivory + Muted Gold theme.
"""

import html
import streamlit as st
from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, navigate_to
from services.notification_service import (
    get_user_notifications,
    get_notification_counts_by_type,
    mark_notification_read,
    mark_all_read,
    get_unread_count,
    NOTIFICATION_TYPE_LABELS,
)
from utils.helpers import days_ago

# Map notification reference_entity -> page key for Open Record action
_ENTITY_PAGE_MAP = {
    "ProcurementRequest": "approve_vendor",   # VM sees PR approval page
    "PurchaseOrder":      "purchase_orders",
    "Invoice":            "invoices",
    "Vendor":             "vendors",
    "Contract":           "contracts",
    "Communication":      "communication",
}

# For non-VM roles, PR notifications should go to procurement page
_ENTITY_PAGE_MAP_PM = {
    "ProcurementRequest": "procurement",
    "PurchaseOrder":      "purchase_orders",
    "Invoice":            "invoices",
    "Vendor":             "vendors",
    "Contract":           "contracts",
    "Communication":      "communication",
}


# ── Type Icon Map ─────────────────────────────────────────────────────────────
_TYPE_SVG = {
    "procurement_approval": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E4B7A" stroke-width="2">'
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
        '<polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>'
        '<line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    ),
    "vendor_assignment": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D6A4A" stroke-width="2">'
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>'
        '<circle cx="9" cy="7" r="4"/>'
        '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>'
        '<path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    ),
    "po_update": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="2">'
        '<rect x="1" y="3" width="15" height="13"/>'
        '<polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>'
        '<circle cx="5.5" cy="18.5" r="2.5"/>'
        '<circle cx="18.5" cy="18.5" r="2.5"/></svg>'
    ),
    "delivery_delay": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B08D57" stroke-width="2">'
        '<circle cx="12" cy="12" r="10"/>'
        '<polyline points="12 6 12 12 16 14"/></svg>'
    ),
    "performance_alert": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B3038" stroke-width="2">'
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
        '<line x1="12" y1="9" x2="12" y2="13"/>'
        '<line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    ),
    "compliance_alert": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B3038" stroke-width="2">'
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    ),
    "invoice_verification": (
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D6A4A" stroke-width="2">'
        '<line x1="12" y1="1" x2="12" y2="23"/>'
        '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
    ),
    # Legacy generic
    "Info": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E4B7A" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    "Success": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D6A4A" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    "Warning": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B08D57" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    "Alert": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B3038" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    "Critical": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B3038" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
}

_TYPE_COLOR = {
    "procurement_approval": "#2E4B7A",
    "vendor_assignment": "#2D6A4A",
    "po_update": "#172033",
    "delivery_delay": "#B08D57",
    "performance_alert": "#8B3038",
    "compliance_alert": "#8B3038",
    "invoice_verification": "#2D6A4A",
    "Info": "#2E4B7A",
    "Success": "#2D6A4A",
    "Warning": "#B08D57",
    "Alert": "#8B3038",
    "Critical": "#8B3038",
}


def render_notifications_page() -> None:
    """Render the Notification & Alert Center."""
    render_page_header(
        "Notifications & Alerts",
        "Real-time procurement approvals, vendor events, delivery alerts, and compliance notifications.",
    )

    user = get_current_user() or {}
    user_id = str(user.get("_id", ""))

    if not user_id:
        st.warning("Authentication error — please log in again.")
        return

    # Counts
    counts = get_notification_counts_by_type(user_id)
    total_unread = counts.get("total", 0)

    # ── Header controls ───────────────────────────────────────────────────────
    hdr1, hdr2, hdr3, hdr4 = st.columns([2, 1.5, 1, 1])
    with hdr1:
        st.markdown(
            f'<div style="color:#526174;font-size:0.88rem;padding-top:0.35rem;">'
            f'You have <strong style="color:#172033;">{total_unread}</strong> unread notification(s).</div>',
            unsafe_allow_html=True,
        )
    with hdr2:
        type_options = ["All"] + list(NOTIFICATION_TYPE_LABELS.keys())
        type_labels_display = ["All Types"] + [NOTIFICATION_TYPE_LABELS[t] for t in list(NOTIFICATION_TYPE_LABELS.keys())]
        type_map = dict(zip(type_labels_display, type_options))
        selected_type_label = st.selectbox("Type", type_labels_display, key="notif_type_filter")
        selected_type = type_map.get(selected_type_label, "All")
    with hdr3:
        unread_only = st.checkbox("Unread only", key="notif_unread_only")
    with hdr4:
        if st.button("Mark All Read", key="notif_mark_all", use_container_width=True):
            ok, msg = mark_all_read(user_id)
            if ok:
                st.success("All notifications marked as read.")
                st.rerun()

    # ── Type summary strip ────────────────────────────────────────────────────
    type_badges = {
        "procurement_approval": ("Procurement", "#2E4B7A"),
        "vendor_assignment": ("Vendor", "#2D6A4A"),
        "po_update": ("Purchase Order", "#172033"),
        "delivery_delay": ("Delivery Delay", "#B08D57"),
        "performance_alert": ("Performance", "#8B3038"),
        "compliance_alert": ("Compliance", "#8B3038"),
        "invoice_verification": ("Invoice", "#2D6A4A"),
    }
    badge_html = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.5rem 0 0.8rem;">'
    for t_key, (t_label, t_color) in type_badges.items():
        count = counts.get(t_key, 0)
        opacity = "1.0" if count > 0 else "0.45"
        badge_html += (
            f'<div style="background:#FFFFFF;border:1px solid {t_color};border-radius:20px;'
            f'padding:3px 10px;display:flex;align-items:center;gap:5px;opacity:{opacity};">'
            f'<span style="font-size:0.72rem;font-weight:700;color:{t_color};">{t_label}</span>'
            f'{"<span style=background:" + t_color + ";color:#FFFFFF;border-radius:10px;padding:0 5px;font-size:0.65rem;font-weight:700;>" + str(count) + "</span>" if count > 0 else ""}'
            f'</div>'
        )
    badge_html += '</div>'
    st.markdown(badge_html, unsafe_allow_html=True)

    # ── Notification list ─────────────────────────────────────────────────────
    render_section_header("Notification Feed", "All platform alerts and workflow events — newest first.")

    notifications = get_user_notifications(
        user_id,
        unread_only=unread_only,
        notif_type=selected_type if selected_type != "All" else None,
        limit=100,
    )

    if not notifications:
        if unread_only:
            render_empty_state("All Caught Up", "You have no unread notifications.")
        elif selected_type != "All":
            render_empty_state("No Notifications", f"No {NOTIFICATION_TYPE_LABELS.get(selected_type, '')} notifications found.")
        else:
            render_empty_state("No Notifications", "Platform alerts and status notifications will appear here as workflow events occur.")
        return

    for notif in notifications:
        n_type = notif.get("notification_type", "Info")
        svg_icon = _TYPE_SVG.get(n_type, _TYPE_SVG["Info"])
        color = _TYPE_COLOR.get(n_type, "#172033")
        is_read = notif.get("is_read", False)
        created_at = notif.get("created_at")
        time_str = days_ago(created_at) if created_at else "Recent"
        notif_id = notif.get("_id", "")
        type_label = NOTIFICATION_TYPE_LABELS.get(n_type, n_type)
        ref_entity  = notif.get("reference_entity", "")
        ref_id      = notif.get("reference_id", "")
        # Route Vendor Manager role to approve_vendor for procurement entities
        from auth.session import get_current_role as _gcr
        _role = _gcr() or ""
        if _role == "Vendor Manager" and ref_entity == "ProcurementRequest":
            target_page = "approve_vendor"
        else:
            target_page = _ENTITY_PAGE_MAP_PM.get(ref_entity, "") if ref_entity else ""

        unread_dot = (
            '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;'
            'background:#172033;margin-right:6px;flex-shrink:0;"></span>'
            if not is_read else ""
        )
        bg = "#FFFFFF" if not is_read else "#F9F8F6"
        border = color if not is_read else "#D9D6CF"

        n_title    = html.escape(notif.get("title", "Notification"))
        n_message  = html.escape(notif.get("message", ""))
        n_entity   = html.escape(ref_entity)
        n_time     = html.escape(time_str)

        col_n, col_btn = st.columns([6, 1])
        with col_n:
            st.markdown(
                f"""
                <div style="background:{bg};border:1px solid {border};border-left:4px solid {color};
                    border-radius:10px;padding:0.85rem 1rem;margin-bottom:0.5rem;
                    box-shadow:0 1px 3px rgba(23,32,51,0.03);">
                    <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem;">
                        {unread_dot}
                        {svg_icon}
                        <span style="font-weight:700;color:#172033;font-size:0.9rem;">
                            {n_title}
                        </span>
                        <span style="margin-left:4px;background:#F7F5F0;border:1px solid #D9D6CF;
                            border-radius:4px;padding:1px 6px;font-size:0.67rem;
                            color:{color};font-weight:700;">{type_label}</span>
                        {f'<span style="font-size:0.67rem;color:#68707C;margin-left:4px;">{n_entity}</span>' if n_entity else ''}
                        <span style="margin-left:auto;font-size:0.72rem;color:#68707C;">{n_time}</span>
                    </div>
                    <div style="color:#526174;font-size:0.84rem;padding-left:1.5rem;line-height:1.55;">
                        {n_message}
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with col_btn:
            st.markdown("<div style='height:0.3rem;'></div>", unsafe_allow_html=True)
            if not is_read and notif_id:
                if st.button("Read", key=f"notif_read_{notif_id}", use_container_width=True):
                    mark_notification_read(notif_id)
                    st.rerun()
            # Open Record button — navigate to the related page if entity is known
            if target_page and ref_id:
                if st.button(
                    "Open",
                    key=f"notif_open_{notif_id}",
                    use_container_width=True,
                    help=f"Open {ref_entity} record",
                ):
                    # Mark as read then navigate
                    if not is_read and notif_id:
                        mark_notification_read(notif_id)
                    navigate_to(target_page)
                    st.rerun()
