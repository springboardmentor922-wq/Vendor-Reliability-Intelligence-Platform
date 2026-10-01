from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole


def init_db(db: Session) -> None:
    admin = db.query(User).filter(User.email == settings.FIRST_ADMIN_EMAIL).first()
    if not admin:
        admin = User(
            full_name=settings.FIRST_ADMIN_NAME,
            email=settings.FIRST_ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
