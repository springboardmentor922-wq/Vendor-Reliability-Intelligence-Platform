"""Application configuration loaded from environment variables / .env."""

import os

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)

    if raw is None:
        return default

    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    PROJECT_NAME: str = "Vendor Reliability Intelligence Platform"
    VERSION: str = "2.0.0"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/vendor_iq"
    )

    # ---- JWT -------------------------------------------------
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "change-me-in-production-vendoriq-secret-key"
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _int("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 8)
    REFRESH_TOKEN_EXPIRE_DAYS: int = _int("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    PASSWORD_RESET_EXPIRE_MINUTES: int = _int("PASSWORD_RESET_EXPIRE_MINUTES", 30)

    # ---- CORS ------------------------------------------------
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:4200,http://127.0.0.1:4200,"
            "http://localhost:5500,http://127.0.0.1:5500"
        ).split(",")
        if origin.strip()
    ]

    # ---- Uploads ---------------------------------------------
    UPLOAD_DIR: str = os.getenv(
        "UPLOAD_DIR",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    )

    # Contracts expiring within this window raise an alert.
    CONTRACT_EXPIRY_ALERT_DAYS: int = _int("CONTRACT_EXPIRY_ALERT_DAYS", 30)

    # ---- Milestone 3: reliability scoring --------------------
    # Weights for the six reliability factors. They are normalised at
    # runtime, so these are relative importances rather than percentages.
    RELIABILITY_WEIGHTS: dict[str, float] = {
        "delivery": _float("WEIGHT_DELIVERY", 0.30),
        "quality": _float("WEIGHT_QUALITY", 0.20),
        "communication": _float("WEIGHT_COMMUNICATION", 0.15),
        "compliance": _float("WEIGHT_COMPLIANCE", 0.15),
        "purchase_history": _float("WEIGHT_PURCHASE_HISTORY", 0.10),
        "issue_resolution": _float("WEIGHT_ISSUE_RESOLUTION", 0.10),
    }

    # Overall-score cut-offs that map a score onto a procurement risk level.
    # Like any supplier scorecard these are calibrated against the supplier
    # base rather than being absolute: they are set so the current book falls
    # into a usable spread instead of collapsing into one band. Override them
    # in .env when the supplier mix changes.
    RISK_THRESHOLD_LOW: float = _float("RISK_THRESHOLD_LOW", 73.0)
    RISK_THRESHOLD_MEDIUM: float = _float("RISK_THRESHOLD_MEDIUM", 65.0)
    RISK_THRESHOLD_HIGH: float = _float("RISK_THRESHOLD_HIGH", 55.0)

    # A vendor needs at least this many closed orders before its score is
    # treated as fully established rather than provisional.
    RELIABILITY_MIN_ORDERS: int = _int("RELIABILITY_MIN_ORDERS", 5)

    # Delivery is judged against the committed date with this tolerance.
    DELIVERY_GRACE_DAYS: int = _int("DELIVERY_GRACE_DAYS", 0)

    # ---- Milestone 3: predictive model -----------------------
    MODEL_DIR: str = os.getenv(
        "MODEL_DIR",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml", "artifacts")
    )

    DATASET_PATH: str = os.getenv(
        "DATASET_PATH",
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
            "DataCoSupplyChainDataset.csv"
        )
    )

    # Probability cut-offs turning a model score into a risk band.
    DELAY_RISK_HIGH: float = _float("DELAY_RISK_HIGH", 0.55)
    DELAY_RISK_MEDIUM: float = _float("DELAY_RISK_MEDIUM", 0.30)

    # ---- Milestone 3: notification delivery ------------------
    # With no SMTP/Twilio credentials configured the platform still records
    # the dispatch and prints the payload, so the flow stays demonstrable.
    EMAIL_ENABLED: bool = _bool("EMAIL_ENABLED", False)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = _int("SMTP_PORT", 587)
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = _bool("SMTP_USE_TLS", True)
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "alerts@vendoriq.com")

    SMS_ENABLED: bool = _bool("SMS_ENABLED", False)
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")

    # Purchase orders running this many days past the committed date raise
    # an escalated delivery-delay alert.
    DELIVERY_DELAY_ALERT_DAYS: int = _int("DELIVERY_DELAY_ALERT_DAYS", 1)

    # Certifications expiring inside this window raise a compliance alert.
    CERTIFICATION_ALERT_DAYS: int = _int("CERTIFICATION_ALERT_DAYS", 60)


settings = Settings()

os.makedirs(settings.MODEL_DIR, exist_ok=True)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
