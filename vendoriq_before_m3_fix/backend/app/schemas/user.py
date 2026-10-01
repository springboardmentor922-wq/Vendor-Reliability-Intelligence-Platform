import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.PROCUREMENT_MANAGER


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(UserBase):
    password: str
    role: UserRole = UserRole.PROCUREMENT_MANAGER
