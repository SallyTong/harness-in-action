from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionFactory
from app.models.child import Child
from app.models.parent import Parent


async def get_db():
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_parent(
    phone: Annotated[str, Query(pattern=r"^\d{11}$")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Parent:
    result = await db.execute(select(Parent).where(Parent.phone == phone))
    parent = result.scalar_one_or_none()

    if parent is not None:
        return parent

    # First use: auto-create parent with default children
    parent = Parent(phone=phone)
    db.add(parent)
    await db.flush()

    default_names = ["小朋友1", "小朋友2"]
    for name in default_names:
        db.add(Child(parent_id=parent.id, name=name))

    await db.flush()
    return parent
