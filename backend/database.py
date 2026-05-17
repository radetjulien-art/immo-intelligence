from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from config import settings
from loguru import logger


# ── Engine async ────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base ORM ────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency FastAPI ───────────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Init database ────────────────────────────────────────────────────────────
async def init_db():
    """Crée les tables et active PostGIS."""
    async with engine.begin() as conn:
        # Activer PostGIS
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        logger.info("Extensions PostGIS activées")

    # Créer chaque table séparément pour éviter les rollbacks en cascade
    for table in Base.metadata.sorted_tables:
        try:
            async with engine.begin() as conn:
                await conn.run_sync(lambda c, t=table: t.create(c, checkfirst=True))
                logger.info(f"Table '{table.name}' OK")
        except Exception as e:
            if "already exists" in str(e):
                logger.info(f"Table '{table.name}' déjà existante, skip")
            else:
                logger.warning(f"Table '{table.name}' : {e}")
