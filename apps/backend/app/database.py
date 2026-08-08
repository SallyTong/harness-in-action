import os
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+aiomysql://root:homework_dev@localhost:3306/homework_grader",
)

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

AsyncSessionFactory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


@asynccontextmanager
async def get_db_session():
    """Standalone async session for background tasks (no FastAPI Depends)."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
