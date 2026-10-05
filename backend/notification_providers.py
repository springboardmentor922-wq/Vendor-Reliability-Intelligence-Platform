"""Provider-neutral outbound notification adapters.

Development works without third-party credentials. Configure SMTP/Twilio-style
settings in the environment when real delivery is required. The adapters keep
provider code out of domain workflows and make Celery integration straightforward.
"""

from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

logger = logging.getLogger("vendoriq.notifications")


class EmailProvider(Protocol):
    def send(self, recipient: str, subject: str, body: str) -> bool: ...


class SmsProvider(Protocol):
    def send(self, recipient: str, message: str) -> bool: ...


@dataclass
class ConsoleEmailProvider:
    """Safe development provider; logs the message instead of sending it."""

    def send(self, recipient: str, subject: str, body: str) -> bool:
        logger.info(
            "EMAIL delivery skipped for %s (%s); configure SMTP_HOST for outbound email.",
            recipient,
            subject,
        )
        return False


@dataclass
class SmtpEmailProvider:
    host: str
    port: int
    username: str | None
    password: str | None
    sender: str
    use_tls: bool = True

    def send(self, recipient: str, subject: str, body: str) -> bool:
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
            if self.use_tls:
                smtp.starttls()
            if self.username:
                smtp.login(self.username, self.password or "")
            smtp.send_message(message)
        return True


@dataclass
class ConsoleSmsProvider:
    """Safe development provider; logs the message instead of sending it."""

    def send(self, recipient: str, message: str) -> bool:
        logger.info("SMS [%s]: %s", recipient, message)
        return True


def get_email_provider() -> EmailProvider:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        return ConsoleEmailProvider()
    return SmtpEmailProvider(
        host=host,
        port=int(os.getenv("SMTP_PORT", "587")),
        username=os.getenv("SMTP_USERNAME") or None,
        password=os.getenv("SMTP_PASSWORD") or None,
        sender=os.getenv("SMTP_FROM", "noreply@vendoriq.local"),
        use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    )


def get_sms_provider() -> SmsProvider:
    # Twilio/FCM integration can be supplied without changing domain modules.
    # Leaving credentials unset intentionally uses the safe development adapter.
    return ConsoleSmsProvider()


def send_email(recipient: str, subject: str, body: str) -> bool:
    try:
        return get_email_provider().send(recipient, subject, body)
    except Exception:
        logger.exception("Outbound email delivery failed")
        return False


def send_sms(recipient: str, message: str) -> bool:
    try:
        return get_sms_provider().send(recipient, message)
    except Exception:
        logger.exception("Outbound SMS delivery failed")
        return False
