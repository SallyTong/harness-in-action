from typing import Annotated

from fastapi import Depends, Header, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionFactory
from app.models.child import Child
from app.models.parent import Parent

DEFAULT_CHILD_NAMES = ["小朋友1", "小朋友2"]


async def create_parent_with_default_children(
    db: AsyncSession,
    *,
    phone: str,
    openid: str | None = None,
) -> Parent:
    """Create a Parent row plus the two default children, mirroring first-use.

    Shared by `get_parent` (Web/phone first use) and `wechat_login` (mini-program
    first bind) so the default-children contract lives in one place.
    """
    parent = Parent(phone=phone, openid=openid)
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


async def get_parent(
    db: Annotated[AsyncSession, Depends(get_db)],
    phone: Annotated[
        str | None,
        Query(
            pattern=r"^\d{11}$",
            description="Parent phone number (identity)",
        ),
    ] = None,
    x_parent_phone: Annotated[
        str | None,
        Header(
            alias="X-Parent-Phone",
            description="Alternative to phone query parameter",
        ),
    ] = None,
) -> Parent:
    # Resolve phone: query param takes priority, fall back to header
    resolved_phone = phone or x_parent_phone or ""

    if not resolved_phone or len(resolved_phone) != 11 or not resolved_phone.isdigit():
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail="Phone number is required (11 digits) via 'phone' query parameter or 'X-Parent-Phone' header.",
        )

    result = await db.execute(select(Parent).where(Parent.phone == resolved_phone))
    parent = result.scalar_one_or_none()

    if parent is not None:
        return parent

    # First use: auto-create parent with default children
    return await create_parent_with_default_children(db, phone=resolved_phone)
