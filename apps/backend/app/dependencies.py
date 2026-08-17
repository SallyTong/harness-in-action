"""Shared dependency-injection helpers: DB session + first-use parent creation."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionFactory
from app.models.child import Child
from app.models.parent import Parent

DEFAULT_CHILD_NAMES = ["小朋友1", "小朋友2"]


async def create_parent_with_default_children(
    db: AsyncSession,
    *,
    phone: str,
) -> Parent:
    """Create a Parent row plus the two default children, mirroring first use.

    Shared by the auth login flow so the default-children contract lives in one
    place. `openid` is no longer written (retained as a column only).
    """
    parent = Parent(phone=phone)
    db.add(parent)
    await db.flush()
    for name in DEFAULT_CHILD_NAMES:
        db.add(Child(parent_id=parent.id, name=name))
    await db.flush()
    return parent


async def get_db():
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
