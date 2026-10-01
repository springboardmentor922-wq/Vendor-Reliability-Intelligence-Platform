"""
SMS notification service — stub implementation (logging only).
In production, replace the body of `send_sms` with a real SMS provider
SDK call (e.g. Twilio, Vonage, AWS SNS).
"""
import logging

logger = logging.getLogger(__name__)


def send_sms(to_phone: str, message: str) -> bool:
    """
    Send an SMS to the given phone number.
    Currently a logging stub — returns True to signal 'accepted'.
    """
    if not to_phone:
        logger.info("[SMS STUB] No phone number provided — skipping.")
        return False

    logger.info("[SMS STUB] Would send SMS to %s: %s", to_phone, message)
    # TODO: replace with real SMS SDK, e.g.:
    #   from twilio.rest import Client
    #   client = Client(account_sid, auth_token)
    #   client.messages.create(body=message, from_=TWILIO_FROM, to=to_phone)
    return True


def send_delivery_delay_sms(to_phone: str, po_number: str) -> bool:
    return send_sms(
        to_phone,
        f"[Procurement Alert] PO {po_number} may be delayed. Please provide an updated ETA."
    )


def send_compliance_sms(to_phone: str, reason: str) -> bool:
    return send_sms(
        to_phone,
        f"[Compliance Alert] Issue flagged: {reason}. Contact your procurement manager."
    )


def send_vendor_approval_sms(to_phone: str, full_name: str, action: str) -> bool:
    """Send SMS when a user account is approved or rejected."""
    if action == "approved":
        msg = f"[Vendor Platform] Hi {full_name}, your account has been APPROVED. You can now log in."
    else:
        msg = f"[Vendor Platform] Hi {full_name}, your account application was not approved. Contact your administrator."
    return send_sms(to_phone, msg)


def send_contract_expiry_sms(to_phone: str, contract_title: str, days_left: int) -> bool:
    """Send SMS when a contract is expiring soon or has expired."""
    if days_left <= 0:
        msg = f"[Vendor Platform] URGENT: Contract '{contract_title}' has EXPIRED. Renewal action required."
    else:
        msg = f"[Vendor Platform] Contract '{contract_title}' expires in {days_left} day(s). Please initiate renewal."
    return send_sms(to_phone, msg)
