from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.deps.auth import get_current_parent_id
from app.models.child import Child
from app.models.submission import Submission
from app.schemas.children import ChildResponse, CreateChildRequest, UpdateChildRequest

router = APIRouter(prefix="/api", tags=["Children"])


async def _get_owned_child(child_id: int, parent_id: int, db: AsyncSession) -> Child:
    """Fetch a child by ID; return 404 if not found or not owned by parent."""
    result = await db.execute(
        select(Child).where(Child.id == child_id, Child.parent_id == parent_id)
    )
    child = result.scalar_one_or_none()
    if child is None:
        raise HTTPException(status_code=404, detail="Child not found")
    return child


async def _get_submission_counts(
    child_ids: list[int], db: AsyncSession
) -> dict[int, int]:
    """Batch-query submission counts for children. Returns {child_id: count}."""
    if not child_ids:
        return {}
    result = await db.execute(
        select(Submission.child_id, func.count())
        .where(Submission.child_id.in_(child_ids))
        .group_by(Submission.child_id)
    )
    return {row[0]: row[1] for row in result.all()}


@router.get("/children", response_model=list[ChildResponse])
async def list_children(
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Child).where(Child.parent_id == parent_id).order_by(Child.id)
    )
    children = result.scalars().all()
    counts = await _get_submission_counts([c.id for c in children], db)
    return [
        ChildResponse(
            id=c.id,
            name=c.name,
            submission_count=counts.get(c.id, 0),
            created_at=c.created_at,
        )
        for c in children
    ]


@router.post(
    "/children", response_model=ChildResponse, status_code=status.HTTP_201_CREATED
)
async def create_child(
    body: CreateChildRequest,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check for duplicate name
    existing = await db.execute(
        select(Child).where(Child.parent_id == parent_id, Child.name == body.name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Child with this name already exists"
        )

    child = Child(parent_id=parent_id, name=body.name)
    db.add(child)
    await db.flush()
    await db.refresh(child)

    return ChildResponse(
        id=child.id,
        name=child.name,
        submission_count=0,
        created_at=child.created_at,
    )


@router.put("/children/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: int,
    body: UpdateChildRequest,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    child = await _get_owned_child(child_id, parent_id, db)

    # Check for duplicate name (exclude current child)
    existing = await db.execute(
        select(Child).where(
            Child.parent_id == parent_id,
            Child.name == body.name,
            Child.id != child_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Child with this name already exists"
        )

    child.name = body.name
    await db.flush()
    await db.refresh(child)

    counts = await _get_submission_counts([child.id], db)
    return ChildResponse(
        id=child.id,
        name=child.name,
        submission_count=counts.get(child.id, 0),
        created_at=child.created_at,
    )


@router.delete("/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_child(
    child_id: int,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    child = await _get_owned_child(child_id, parent_id, db)
    await db.delete(child)
