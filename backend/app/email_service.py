"""
Email notification service — best-effort, non-blocking SMTP.
Reads SMTP credentials from environment variables.
If credentials are absent, the call is a no-op (logged only).
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@procurement.local")


def send_email(to_address: str, subject: str, body_html: str) -> bool:
    """
    Send an HTML email to the given address.
    Returns True on success, False on any error (non-blocking).
    """
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, to_address]):
        logger.info(
            "[EMAIL STUB] SMTP not configured — would have sent '%s' to %s",
            subject,
            to_address,
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_address
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to_address], msg.as_string())

        logger.info("[EMAIL] Sent '%s' to %s", subject, to_address)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[EMAIL] Failed to send '%s' to %s: %s", subject, to_address, exc)
        return False


def send_delivery_delay_alert(vendor_email: str, vendor_name: str, po_number: str) -> bool:
    subject = f"⚠️ Delivery Delay Alert — PO {po_number}"
    body = f"""
    <html><body>
    <p>Dear <strong>{vendor_name}</strong>,</p>
    <p>Our procurement system has flagged purchase order <strong>{po_number}</strong>
    as potentially delayed. Please provide an updated ETA at your earliest convenience.</p>
    <p style="color:#f59e0b;">This is an automated alert from your Vendor Reliability Platform.</p>
    </body></html>
    """
    return send_email(vendor_email, subject, body)


def send_compliance_flag_alert(vendor_email: str, vendor_name: str, reason: str) -> bool:
    subject = "🚨 Compliance Flag — Action Required"
    body = f"""
    <html><body>
    <p>Dear <strong>{vendor_name}</strong>,</p>
    <p>A compliance issue has been flagged on your account:</p>
    <blockquote style="color:#ef4444;">{reason}</blockquote>
    <p>Please contact your procurement manager immediately.</p>
    </body></html>
    """
    return send_email(vendor_email, subject, body)


def send_vendor_approval_email(user_email: str, full_name: str, action: str) -> bool:
    """Send email when a vendor user is approved or rejected."""
    if action == "approved":
        subject = "✅ Your Procurement Account Has Been Approved"
        body = f"""
    <html><body>
    <p>Dear <strong>{full_name}</strong>,</p>
    <p>Your account on the Vendor Reliability Platform has been <strong style="color:#10b981;">approved</strong>.
    You can now log in and access the platform.</p>
    <p style="color:#6b7280;">This is an automated notification from your Vendor Reliability Platform.</p>
    </body></html>
    """
    else:
        subject = "❌ Your Procurement Account Application Was Not Approved"
        body = f"""
    <html><body>
    <p>Dear <strong>{full_name}</strong>,</p>
    <p>Unfortunately your account on the Vendor Reliability Platform has been <strong style="color:#ef4444;">rejected</strong>.
    Please contact your administrator for more information.</p>
    <p style="color:#6b7280;">This is an automated notification from your Vendor Reliability Platform.</p>
    </body></html>
    """
    return send_email(user_email, subject, body)


def send_contract_expiry_email(contact_email: str, vendor_name: str, contract_title: str, days_left: int) -> bool:
    """Send email when a contract is expiring soon or is already expired."""
    if days_left <= 0:
        subject = f"🔴 Contract Expired — {contract_title}"
        urgency = "has <strong>expired</strong>"
    else:
        subject = f"⚠️ Contract Expiring in {days_left} Days — {contract_title}"
        urgency = f"is expiring in <strong>{days_left} days</strong>"
    body = f"""
    <html><body>
    <p>Dear <strong>{vendor_name}</strong>,</p>
    <p>The contract <strong>"{contract_title}"</strong> {urgency}.</p>
    <p>Please contact your procurement manager to initiate a renewal or extension.</p>
    <p style="color:#6b7280;">This is an automated alert from your Vendor Reliability Platform.</p>
    </body></html>
    """
    return send_email(contact_email, subject, body)
