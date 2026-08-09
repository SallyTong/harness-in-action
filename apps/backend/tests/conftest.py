import os
import tempfile

import httpx
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.dependencies import get_db
from app.main import app
from app.models import Base

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "mysql+aiomysql://root:homework_dev@localhost:3306/homework_grader_test",
)

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionFactory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

# Temp directory for test images — avoids polluting the real data/images/
_test_image_dir: tempfile.TemporaryDirectory | None = None


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_test_db():
    """Create test DB tables, redirect image paths to a temp dir, clean up after."""
    global _test_image_dir

    # Create temp dir for test images before any test runs
    _test_image_dir = tempfile.TemporaryDirectory(prefix="homework_test_images_")
    test_img_dir = _test_image_dir.name

    # Redirect image storage paths to the temp directory
    import app.routers.submissions as sub_router
    import app.services.grading as grading_mod

    _orig_router_originals = sub_router.IMAGE_ORIGINALS
    _orig_grading_originals = grading_mod.IMAGE_ORIGINALS
    _orig_grading_annotated = grading_mod.IMAGE_ANNOTATED
    _orig_grading_thumbnails = grading_mod.IMAGE_THUMBNAILS
    _orig_grading_questions = grading_mod.IMAGE_QUESTIONS

    sub_router.IMAGE_ORIGINALS = f"{test_img_dir}/originals"
    grading_mod.IMAGE_ORIGINALS = f"{test_img_dir}/originals"
    grading_mod.IMAGE_ANNOTATED = f"{test_img_dir}/annotated"
    grading_mod.IMAGE_THUMBNAILS = f"{test_img_dir}/thumbnails"
    grading_mod.IMAGE_QUESTIONS = f"{test_img_dir}/questions"

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

    # Restore original paths
    sub_router.IMAGE_ORIGINALS = _orig_router_originals
    grading_mod.IMAGE_ORIGINALS = _orig_grading_originals
    grading_mod.IMAGE_ANNOTATED = _orig_grading_annotated
    grading_mod.IMAGE_THUMBNAILS = _orig_grading_thumbnails
    grading_mod.IMAGE_QUESTIONS = _orig_grading_questions

    # Clean up temp directory and its contents
    _test_image_dir.cleanup()

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session():
    async with test_engine.connect() as connection:
        tx = await connection.begin()
        async with TestSessionFactory(bind=connection) as session:
            yield session
            await session.close()
        await tx.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
