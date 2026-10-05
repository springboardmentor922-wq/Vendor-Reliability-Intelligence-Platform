import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vendor Reliability Intelligence Platform (VendorIQ)"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_key_change_me_in_production_1234567890")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 Days

    # Database Settings
    # On Vercel serverless environment, use /tmp/vendoriq.db since the app root is read-only
    _default_sqlite = (
        "sqlite:////tmp/vendoriq.db" 
        if os.getenv("VERCEL") 
        else f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'vendoriq.db')}"
    )
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_sqlite)

    class Config:
        case_sensitive = True

settings = Settings()
