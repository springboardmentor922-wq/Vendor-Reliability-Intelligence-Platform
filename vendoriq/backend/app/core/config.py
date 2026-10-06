import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "VendorIQ - Vendor Reliability Intelligence & Procurement Risk Management Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))

    # Falls back to a local SQLite file if DATABASE_URL is not provided,
    # so the app runs out of the box. Set DATABASE_URL to a Postgres DSN
    # (postgresql://user:pass@host:5432/dbname) for production, per the
    # project's tech stack (PostgreSQL).
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./vendoriq.db")

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

    FIRST_ADMIN_EMAIL: str = os.getenv("FIRST_ADMIN_EMAIL", "admin@vendoriq.com")
    FIRST_ADMIN_PASSWORD: str = os.getenv("FIRST_ADMIN_PASSWORD", "Admin@123")
    FIRST_ADMIN_NAME: str = os.getenv("FIRST_ADMIN_NAME", "System Administrator")
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
