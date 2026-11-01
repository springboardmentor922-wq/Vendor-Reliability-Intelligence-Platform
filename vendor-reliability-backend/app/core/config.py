import os
from typing import List

class Settings:
    PROJECT_NAME: str = "Vendor Reliability & Risk Management System"
    VERSION: str = "2.0.0"
    API_V1_STR: str = ""
    
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "vendor-iq-super-secure-jwt-secret-key-production-ready-2026-auth"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./vendors.db"
    )
    
    CORS_ORIGINS: List[str] = ["*"]
    
    # Exactly 6 Roles (Strict RBAC)
    ROLES: List[str] = [
        "Administrator",
        "Procurement Manager",
        "Finance Officer",
        "Supply Chain Manager",
        "Vendor",
        "Auditor"
    ]
    
    # Standard Departments
    DEPARTMENTS: List[str] = [
        "Information Technology",
        "Manufacturing & Production",
        "Supply Chain & Logistics",
        "Corporate Finance",
        "Operations & Facilities",
        "Human Resources",
        "Research & Development"
    ]
    
    # Exactly 6 Official Vendor Categories
    VENDOR_CATEGORIES: List[str] = [
        "IT & Electronics",
        "Raw Materials",
        "Office Supplies & Equipment",
        "Machinery & Spare Parts",
        "Logistics & Transportation",
        "Services & Maintenance"
    ]

settings = Settings()
