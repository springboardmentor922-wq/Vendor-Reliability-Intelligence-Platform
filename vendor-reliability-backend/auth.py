# Backward compatibility wrapper for auth
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.dependencies import get_db, get_current_user, require_roles
from app.core.config import settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
