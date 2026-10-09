from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.enums import UserRole, VendorCategory

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.VENDOR
    phone: Optional[str] = None
    vendor_id: Optional[int] = None

    company_name: Optional[str] = None
    category: Optional[VendorCategory] = None
    contact_person: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool
    vendor_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    new_role: UserRole

Token.model_rebuild()
