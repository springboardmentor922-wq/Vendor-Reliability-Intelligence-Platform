# Backward compatibility wrapper for database session
from app.db.session import engine, SessionLocal, db_url as DATABASE_URL
from app.db.base import Base
