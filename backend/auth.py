from datetime import datetime, timedelta, timezone
import os

from jose import JWTError, jwt
from passlib.context import CryptContext


# Secret key used to create JWT tokens.
# Override in production by setting the SECRET_KEY environment variable.
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "a0a35d6d1f8b2c9e4f7a1b3c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4"
)

# Algorithm used for JWT
ALGORITHM = "HS256"

# Token validity
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# Password hashing configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def verify_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload

    except JWTError:
        return None