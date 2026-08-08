import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+aiomysql://root:homework_dev@localhost:3306/homework_grader",
)

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

AsyncSessionFactory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)
