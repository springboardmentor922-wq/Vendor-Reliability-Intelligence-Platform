import time
import logging
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.sql import text
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("app.database")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

class FallbackInMemoryRedis:
    def __init__(self):
        self._store = {}
        self._expirations = {}

    async def get(self, key: str) -> Optional[str]:
        if key in self._expirations and time.time() > self._expirations[key]:
            self._store.pop(key, None)
            self._expirations.pop(key, None)
            return None
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = str(value)
        if ex:
            self._expirations[key] = time.time() + ex
        return True

    async def delete(self, key: str) -> int:
        removed = 1 if key in self._store else 0
        self._store.pop(key, None)
        self._expirations.pop(key, None)
        return removed

    async def ping(self) -> bool:
        return True

class RedisManager:
    def __init__(self):
        self._client: Optional[aioredis.Redis] = None
        self._fallback = FallbackInMemoryRedis()
        self._using_fallback = False

    async def get_client(self):
        if self._client is None and not self._using_fallback:
            try:
                client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                await client.ping()
                self._client = client
                self._using_fallback = False
            except Exception:
                logger.warning("Redis is unreachable at %s; using in-memory token fallback.", settings.REDIS_URL)
                self._using_fallback = True
        return self._client if (self._client and not self._using_fallback) else self._fallback

    async def is_connected(self) -> bool:
        try:
            client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            res = await client.ping()
            await client.aclose()
            return bool(res)
        except Exception:
            return False

redis_manager = RedisManager()

async def get_redis():
    return await redis_manager.get_client()

async def check_db_health() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("DB health check failed: %s", e)
        return False
