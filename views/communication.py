"""
views/communication.py
-----------------------
Communication Center — Milestone 3.

Role-based messaging between all 6 platform roles:
  Vendor, Procurement Manager, Supply Chain Manager,
  Finance Officer, Administrator, Auditor (read-only)

Features:
  - Tab 1: Conversations  — thread list with unread badge; click to view + reply
  - Tab 2: New Message    — compose to vendor thread, PR thread, or PO thread
  - Tab 3: All Threads    — directory with last message preview + timestamps + unread badge

Auditor: sees all threads and messages but cannot send (read-only).
All conversations stored in MongoDB COLLECTION_COMMUNICATIONS.
Deep Navy #172033 + Muted Gold #B08D57 theme. Zero emoji.

Performance optimisations (M3):
  - Vendor list fetched once via get_cached_vendors_for_comms() (TTL 2 min)
  - All Threads unread counts fetched in one batch aggregate instead of N queries
"""

import streamlit as st
from datetime import datetime, timezone
from components.navbar import render_page_header
from components.cards import render_section_header, render_empty_state
from auth.session import get_current_user, get_current_role
from auth.permissions import (
    has_action_permission,
    ACTION_SEND_MESSAGE,
    ACTION_VIEW_MESSAGES,
    ROLE_AUDITOR,
)
from services.communication_service import (
    send_message,
    get_messages,
    get_all_threads,
    get_thread_stats,
    get_unread_thread_count,
    get_batch_unread_counts,
    mark_thread_read,
)
from services.cache_service import get_cached_vendors_for_comms
from services.procurement_service import get_procurement_requests, get_purchase_orders


def _format_ts(dt) -> str:
    """Format a datetime for message bubbles."""
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt[:16]
    try:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - dt
        if delta.total_seconds() < 60:
            return "Just now"
        if delta.total_seconds() < 3600:
            mins = int(delta.total_seconds() / 60)
            return f"{mins}m ago"
        if delta.days == 0:
            return dt.strftime("%H:%M")
        return dt.strftime("%b %d, %H:%M")
    except Exception:
        return str(dt)[:16]


def _role_badge(role: str) -> str:
    role_colors = {
        "Administrator": "#172033",
        "Procurement Manager": "#2E4B7A",
        "Supply Chain Manager": "#2D6A4A",
        "Finance Officer": "#B08D57",
        "Vendor": "#68707C",
        "Auditor": "#8B3038",
    }
    color = role_colors.get(role, "#68707C")
    return (
        f'<span style="background:{color};color:#FFFFFF;border-radius:3px;'
        f'padding:1px 5px;font-size:0.65rem;font-weight:700;">{role}</span>'
    )


def _render_message_thread(messages: list, current_user_id: str, read_only: bool = False) -> None:
    """Render threaded enterprise message bubbles."""
    if not messages:
        render_empty_state(
            "No Message History",
            "No messages in this thread yet." if not read_only else "No messages to display.",
        )
        return

    for msg in messages:
        is_mine = msg.get("sender_id") == current_user_id
        sender = msg.get("sender_name", "User")
        sender_role = msg.get("sender_role", "")
        content = msg.get("content", "")
        ts = _format_ts(msg.get("created_at"))

        if is_mine:
            st.markdown(
                f"""
                <div style="display:flex;justify-content:flex-end;margin-bottom:0.75rem;">
                    <div style="max-width:72%;background:#172033;color:#FFFFFF;
                        border-radius:10px 10px 2px 10px;padding:0.75rem 1rem;
                        box-shadow:0 1px 4px rgba(23,32,51,0.25);">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:0.25rem;">
                            <span style="font-size:0.72rem;font-weight:700;color:#B08D57;">{sender} (You)</span>
                            {_role_badge(sender_role) if sender_role else ""}
                        </div>
                        <div style="font-size:0.87rem;line-height:1.5;">{content}</div>
                        <div style="font-size:0.65rem;color:rgba(255,255,255,0.6);text-align:right;margin-top:0.35rem;">{ts}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                f"""
                <div style="display:flex;justify-content:flex-start;margin-bottom:0.75rem;">
                    <div style="max-width:72%;background:#FFFFFF;border:1px solid #D9D6CF;
                        color:#20242A;border-radius:10px 10px 10px 2px;padding:0.75rem 1rem;
                        box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:0.25rem;">
                            <span style="font-size:0.72rem;font-weight:700;color:#B08D57;">{sender}</span>
                            {_role_badge(sender_role) if sender_role else ""}
                        </div>
                        <div style="font-size:0.87rem;line-height:1.5;color:#20242A;">{content}</div>
                        <div style="font-size:0.65rem;color:#68707C;text-align:right;margin-top:0.35rem;">{ts}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )


def render_communication_page() -> None:
    """Render the Communication Hub page."""
    render_page_header(
        "Communication Center",
        "Role-based threaded messaging between all platform participants — with full conversation history.",
    )

    user = get_current_user() or {}
    role = get_current_role()
    user_id = str(user.get("_id", ""))
    user_name = user.get("name", "User")

    can_view = has_action_permission(role, ACTION_VIEW_MESSAGES)
    can_send = has_action_permission(role, ACTION_SEND_MESSAGE)
    is_auditor = role == ROLE_AUDITOR

    if not can_view:
        st.warning("You do not have permission to view messages.")
        return

    # ── KPI Cards ─────────────────────────────────────────────────────────────
    stats = get_thread_stats()
    unread_threads = get_unread_thread_count(user_id) if user_id and not is_auditor else 0

    col1, col2, col3, col4 = st.columns(4)
    cards = [
        (col1, "Total Messages", stats.get("total_messages", 0), "#172033"),
        (col2, "Vendor Threads", stats.get("vendor_threads", 0), "#B08D57"),
        (col3, "Procurement Threads", stats.get("procurement_threads", 0), "#2D6A4A"),
        (col4, "Unread Threads", unread_threads, "#8B3038"),
    ]
    for col, label, val, color in cards:
        with col:
            st.markdown(
                f'<div style="background:#FFFFFF;border:1px solid #D9D6CF;border-left:4px solid {color};'
                f'border-radius:10px;padding:0.85rem 1rem;box-shadow:0 1px 3px rgba(23,32,51,0.04);">'
                f'<div style="font-size:0.68rem;color:#68707C;font-weight:700;text-transform:uppercase;">{label}</div>'
                f'<div style="font-size:1.55rem;font-weight:800;color:{color};margin-top:2px;">{val:,}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )

    if is_auditor:
        st.markdown(
            '<div style="background:#FBE9E9;border:1px solid #8B3038;border-radius:8px;padding:0.6rem 1rem;'
            'margin:0.75rem 0;color:#8B3038;font-size:0.85rem;font-weight:600;">'
            'Auditor — Read-Only View. You can view all conversation threads but cannot send messages.</div>',
            unsafe_allow_html=True,
        )

    st.markdown("<div style='margin-bottom:0.6rem;'></div>", unsafe_allow_html=True)

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_labels = ["Conversations", "All Threads"]
    if can_send:
        tab_labels = ["Conversations", "New Message", "All Threads"]
    tabs = st.tabs(tab_labels)

    # ── Tab: Conversations ────────────────────────────────────────────────────
    with tabs[0]:
        _render_conversations_tab(user_id, user_name, role, can_send, is_auditor)

    # ── Tab: New Message ──────────────────────────────────────────────────────
    if can_send:
        with tabs[1]:
            _render_compose_tab(user_id, user_name, role)

    # ── Tab: All Threads ──────────────────────────────────────────────────────
    with tabs[-1]:
        _render_all_threads_tab(user_id, is_auditor)


# ── Helpers — shared vendor/PR/PO selectors ───────────────────────────────────

def _get_vendor_map() -> dict:
    """Return label → vendor_id dict from cached vendor list."""
    vendors = get_cached_vendors_for_comms()
    return {
        f"{v.get('company_name', '')} ({v.get('vendor_code', '')})": v["_id"]
        for v in vendors
    }


# ── Conversations Tab ─────────────────────────────────────────────────────────

def _render_conversations_tab(user_id, user_name, role, can_send, is_auditor):
    render_section_header("Select Thread")

    thread_type = st.radio(
        "Thread type",
        ["Vendor", "Procurement Request", "Purchase Order"],
        horizontal=True,
        key="comm_thread_type",
    )

    if thread_type == "Vendor":
        v_map = _get_vendor_map()
        if not v_map:
            render_empty_state("No Vendors", "No vendors registered yet.")
            return
        sel_label = st.selectbox("Select Vendor Thread", list(v_map.keys()), key="comm_v_sel")
        sel_id = v_map[sel_label]
        t_type = "vendor"
        t_label = sel_label.split(" (")[0] if " (" in sel_label else sel_label

    elif thread_type == "Procurement Request":
        prs = get_procurement_requests()
        if not prs:
            render_empty_state("No Requisitions", "Create procurement requests to start discussions.")
            return
        pr_map = {
            f"{pr.get('request_number', 'PR')} — {pr.get('department', '')} ({pr.get('status', '')})": str(pr.get("_id", ""))
            for pr in prs
        }
        sel_label = st.selectbox("Select PR Thread", list(pr_map.keys()), key="comm_pr_sel")
        sel_id = pr_map[sel_label]
        t_type = "procurement"
        t_label = sel_label.split(" — ")[0] if " — " in sel_label else sel_label

    else:  # Purchase Order
        pos = get_purchase_orders()[:100]
        if not pos:
            render_empty_state("No Purchase Orders", "Create purchase orders to start discussions.")
            return
        po_map = {
            f"{po.get('po_number', 'PO')} — {po.get('status', '')} — ${po.get('total_amount', 0):,.0f}": str(po.get("_id", ""))
            for po in pos
        }
        sel_label = st.selectbox("Select PO Thread", list(po_map.keys()), key="comm_po_sel")
        sel_id = po_map[sel_label]
        t_type = "purchase_order"
        t_label = sel_label.split(" — ")[0] if " — " in sel_label else sel_label

    # Mark thread read when opened
    if user_id and not is_auditor:
        mark_thread_read(t_type, sel_id, user_id)

    render_section_header(f"Thread: {t_label}")
    messages = get_messages(t_type, sel_id)
    _render_message_thread(messages, user_id, read_only=is_auditor)

    if can_send:
        st.markdown("<div style='height:0.4rem;'></div>", unsafe_allow_html=True)
        with st.form(f"msg_form_{t_type}_{sel_id}", clear_on_submit=True):
            text = st.text_area(
                "Message",
                placeholder="Type your message...",
                key=f"msg_in_{t_type}_{sel_id}",
                height=80,
            )
            col_s, col_c = st.columns([3, 1])
            with col_s:
                submitted = st.form_submit_button("Send Message", type="primary")
            if submitted:
                if text.strip():
                    ok, res = send_message(
                        sender_id=user_id,
                        sender_name=user_name,
                        thread_type=t_type,
                        thread_id=sel_id,
                        thread_label=t_label,
                        content=text.strip(),
                        sender_role=role or "",
                    )
                    if ok:
                        st.success("Message sent.")
                        st.rerun()
                    else:
                        st.error(res)
                else:
                    st.warning("Message cannot be empty.")


# ── Compose Tab ───────────────────────────────────────────────────────────────

def _render_compose_tab(user_id, user_name, role):
    render_section_header("Compose New Message", "Start or continue a conversation thread")

    c1, c2 = st.columns(2)
    with c1:
        t_type_options = {
            "Vendor Conversation": "vendor",
            "Procurement Request Discussion": "procurement",
            "Purchase Order Discussion": "purchase_order",
        }
        sel_type_label = st.selectbox("Conversation Type", list(t_type_options.keys()), key="compose_type")
        t_type = t_type_options[sel_type_label]

    with c2:
        if t_type == "vendor":
            v_map = _get_vendor_map()
            if v_map:
                sel_label = st.selectbox("Select Vendor", list(v_map.keys()), key="compose_vendor")
                sel_id = v_map[sel_label]
                t_label = sel_label.split(" (")[0]
            else:
                st.info("No vendors found.")
                return
        elif t_type == "procurement":
            prs = get_procurement_requests()
            if prs:
                pr_map = {f"{pr.get('request_number', 'PR')} — {pr.get('department', '')}": str(pr.get("_id", "")) for pr in prs}
                sel_label = st.selectbox("Select PR", list(pr_map.keys()), key="compose_pr")
                sel_id = pr_map[sel_label]
                t_label = sel_label.split(" — ")[0]
            else:
                st.info("No procurement requests found.")
                return
        else:
            pos = get_purchase_orders()[:100]
            if pos:
                po_map = {f"{po.get('po_number', 'PO')} — ${po.get('total_amount', 0):,.0f}": str(po.get("_id", "")) for po in pos}
                sel_label = st.selectbox("Select PO", list(po_map.keys()), key="compose_po")
                sel_id = po_map[sel_label]
                t_label = sel_label.split(" — ")[0]
            else:
                st.info("No purchase orders found.")
                return

    with st.form("compose_form", clear_on_submit=True):
        msg_text = st.text_area(
            "Message",
            placeholder="Type your message here...",
            height=120,
            key="compose_text",
        )
        if st.form_submit_button("Send Message", type="primary", use_container_width=True):
            if msg_text.strip():
                ok, res = send_message(
                    sender_id=user_id,
                    sender_name=user_name,
                    thread_type=t_type,
                    thread_id=sel_id,
                    thread_label=t_label,
                    content=msg_text.strip(),
                    sender_role=role or "",
                )
                if ok:
                    st.success(f"Message sent to {t_label} thread.")
                    st.rerun()
                else:
                    st.error(res)
            else:
                st.warning("Message cannot be empty.")


# ── All Threads Tab ───────────────────────────────────────────────────────────

def _render_all_threads_tab(user_id, is_auditor):
    render_section_header("Active Conversation Threads", "All threads ordered by most recent activity")

    type_filter = st.radio(
        "Filter",
        ["All", "Vendor", "Procurement", "Purchase Order"],
        horizontal=True,
        key="threads_type_filter",
    )
    type_map = {"Vendor": "vendor", "Procurement": "procurement", "Purchase Order": "purchase_order"}
    t_type_param = type_map.get(type_filter) if type_filter != "All" else None

    all_threads = get_all_threads(thread_type=t_type_param, limit=100)

    if not all_threads:
        render_empty_state("No Active Threads", "No conversations recorded yet.")
        return

    # Batch-fetch all unread counts in a single query instead of N separate queries
    batch_unread: dict = {}
    if user_id and not is_auditor:
        batch_unread = get_batch_unread_counts(user_id)

    for t in all_threads:
        t_label = t.get("thread_label", "Thread")
        t_type = t.get("thread_type", "General")
        t_last = t.get("last_message", "")
        t_sender = t.get("last_sender", "")
        t_sender_role = t.get("last_sender_role", "")
        t_cnt = t.get("message_count", 0)
        t_ts = _format_ts(t.get("last_at"))

        # O(1) lookup from batch dict
        unread = batch_unread.get((t_type, t.get("thread_id", "")), 0)

        type_colors = {
            "vendor": "#B08D57", "procurement": "#2D6A4A",
            "purchase_order": "#172033", "general": "#68707C",
        }
        t_color = type_colors.get(t_type, "#68707C")
        t_type_display = t_type.replace("_", " ").title()

        unread_html = (
            f'<span style="background:#8B3038;color:#FFFFFF;border-radius:10px;'
            f'padding:0 6px;font-size:0.65rem;font-weight:700;">{unread}</span>'
            if unread > 0 else ""
        )

        st.markdown(
            f'''
            <div style="background:#FFFFFF;border:1px solid {'#172033' if unread > 0 else '#D9D6CF'};
                border-left:4px solid {t_color};border-radius:8px;padding:0.75rem 1rem;
                margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;">
                        <span style="background:{t_color};color:#FFFFFF;border-radius:4px;
                            padding:1px 6px;font-size:0.67rem;font-weight:700;text-transform:uppercase;">{t_type_display}</span>
                        <span style="font-weight:700;font-size:0.88rem;color:#20242A;">{t_label}</span>
                        {unread_html}
                    </div>
                    <div style="font-size:0.78rem;color:#68707C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        <b style="color:#526174;">{t_sender}</b>
                        {_role_badge(t_sender_role) if t_sender_role else ""}
                        : {t_last[:80] if t_last else "—"}
                    </div>
                </div>
                <div style="text-align:right;margin-left:1rem;flex-shrink:0;">
                    <div style="font-size:0.72rem;color:#68707C;">{t_ts}</div>
                    <div style="font-size:0.72rem;color:#B08D57;font-weight:700;">{t_cnt} msg(s)</div>
                </div>
            </div>
            ''',
            unsafe_allow_html=True,
        )
