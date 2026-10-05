from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import User, RoleEnum
from app.core.security import verify_password, hash_password, create_access_token
from pydantic import BaseModel, EmailStr
import jwt
from typing import Any

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# 1. Configure OAuth2 scheme for Swagger UI Authorization button
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- Schemas ---

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: RoleEnum = RoleEnum.PROCUREMENT_MGR

class PasswordResetPayload(BaseModel):
    email: EmailStr
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str

class UserProfileResponse(BaseModel):
    email: EmailStr
    full_name: str
    role: str

# --- Helper Functions ---

def safe_role_str(role: Any) -> str:
    """Safely extracts role string whether stored as Enum or str."""
    return role.value if hasattr(role, "value") else str(role)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Reusable dependency to protect endpoints across all microservices."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Replace SECRET_KEY with your value from core/config.py
        from app.core.config import settings
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

# --- Routes ---

@router.post("/register", response_model=Token)
def register_user(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already registered")
    
    new_user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    role_str = safe_role_str(new_user.role)
    token = create_access_token({"sub": new_user.email, "role": role_str})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": role_str, 
        "full_name": new_user.full_name
    }

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    role_str = safe_role_str(user.role)
    token = create_access_token({"sub": user.email, "role": role_str})
    return {
        "access_token": token, 
        "token_type": "bearer", 
        "role": role_str, 
        "full_name": user.full_name
    }

@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Fetch current user profile using JWT authorization token."""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": safe_role_str(current_user.role)
    }

@router.post("/password-reset")
def password_reset(payload: PasswordResetPayload, db: Session = Depends(get_db)):
    """Reset user password."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset successfully"}