from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={
            "check_same_thread": False,
            "timeout": 20
        },
        pool_pre_ping=True
    )
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB Cache
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA mmap_size=268435456") # 256MB MMAP
        cursor.close()
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=30
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
