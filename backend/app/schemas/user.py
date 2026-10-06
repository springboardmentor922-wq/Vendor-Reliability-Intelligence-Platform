from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserRole(str, Enum):
    ADMINISTRATOR = "ADMINISTRATOR"
    PROCUREMENT_MANAGER = "PROCUREMENT_MANAGER"
    SUPPLY_CHAIN_MANAGER = "SUPPLY_CHAIN_MANAGER"
    VENDOR = "VENDOR"
    FINANCE_OFFICER = "FINANCE_OFFICER"
    AUDITOR = "AUDITOR"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = UserRole.PROCUREMENT_MANAGER


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
