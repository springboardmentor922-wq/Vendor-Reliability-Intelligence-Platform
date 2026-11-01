from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    role: Optional[str] = "Procurement Manager"
    phone: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None

class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Optional[str] = "Procurement Manager"
    phone: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = "Information Technology"
    vendor_category: Optional[str] = None
    product_service: Optional[str] = None
    business_reg_number: Optional[str] = None
    gst_tax_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str  # Accepts email address, username prefix, or name alias
    password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str  # Accepts email or username

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None
    company: Optional[str] = None
    department: Optional[str] = None
    vendor_category: Optional[str] = None
    product_service: Optional[str] = None
    business_reg_number: Optional[str] = None
    gst_tax_id: Optional[str] = None
    is_active: bool
    approval_status: Optional[str] = "APPROVED"
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    vendor_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RegistrationPendingResponse(BaseModel):
    message: str
    user_id: int
    email: str
    approval_status: str
