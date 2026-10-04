from pydantic_settings import BaseSettings
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "VendorIQ – Vendor Reliability Platform"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super-secret-jwt-key-for-vendoriq-risk-management-platform"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # Defaults to SQLite for immediate zero-config execution; seamlessly accepts PostgreSQL connection strings
    DATABASE_URL: str = "sqlite:///./vendoriq.db"
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
