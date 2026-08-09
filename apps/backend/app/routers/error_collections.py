"""Error collection endpoints: browse wrong answers and generate practice sheets."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_parent
from app.models.child import Child
from app.models.error_question import ErrorQuestion
from app.models.parent import Parent
from app.schemas.error_collections import (
    ErrorCollectionListResponse,
    ErrorQuestionResponse,
    GenerateSheetRequest,
    GenerateSheetResponse,
)
from app.services.annotation import compose_sheet

router = APIRouter(prefix="/api", tags=["Error Collections"])

VALID_SUBJECTS = {"english", "math"}
VALID_QUESTION_TYPES = frozenset(
    {"choice", "fill_blank", "reading", "composition", "calculation", "word_problem"}
)


def _build_image_url(request: Request, rel_path: str | None, phone: str = "") -> str | None:
    if not rel_path:
        return None
    base = str(request.base_url).rstrip("/")
    # Normalize Windows backslash paths and strip the data/images/ prefix
    normalized = rel_path.replace("\\", "/")
    if normalized.startswith("data/images/"):
        kind_and_file = normalized[len("data/images/"):]
    else:
        kind_and_file = normalized.replace("data/images/", "", 1)
    url = f"{base}/api/images/{kind_and_file}"
    if phone:
        url += f"?phone={phone}"
    return url


@router.get("/error-collections", response_model=ErrorCollectionListResponse)
async def list_error_questions(
    request: Request,
    parent: Annotated[Parent, Depends(get_parent)],
    db: Annotated[AsyncSession, Depends(get_db)],
    child_id: int | None = None,
    subject: str | None = None,
    question_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List error questions with multi-dimensional filters.

    Ownership is enforced via JOIN on Child with parent_id filter.
    Filters: child_id, subject, question_type, date range (on last_error_at).
    """
    # Base query: ErrorQuestion JOIN Child to verify parent ownership
    base_query = (
        select(ErrorQuestion)
        .join(Child, ErrorQuestion.child_id == Child.id)
        .where(Child.parent_id == parent.id)
    )
    count_query = (
        select(func.count())
        .select_from(ErrorQuestion)
        .join(Child, ErrorQuestion.child_id == Child.id)
        .where(Child.parent_id == parent.id)
    )

    if child_id is not None:
        base_query = base_query.where(ErrorQuestion.child_id == child_id)
        count_query = count_query.where(ErrorQuestion.child_id == child_id)

    if subject is not None:
        base_query = base_query.where(ErrorQuestion.subject == subject)
        count_query = count_query.where(ErrorQuestion.subject == subject)

    if question_type is not None:
        base_query = base_query.where(ErrorQuestion.question_type == question_type)
        count_query = count_query.where(ErrorQuestion.question_type == question_type)

    if from_date is not None:
        try:
            dt = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            base_query = base_query.where(ErrorQuestion.last_error_at >= dt)
            count_query = count_query.where(ErrorQuestion.last_error_at >= dt)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="from_date must be YYYY-MM-DD format"
            )

    if to_date is not None:
        try:
            dt = datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            # Include the entire to_date day (strictly before next day)
            dt_end = dt + timedelta(days=1)
            base_query = base_query.where(ErrorQuestion.last_error_at < dt_end)
            count_query = count_query.where(ErrorQuestion.last_error_at < dt_end)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="to_date must be YYYY-MM-DD format"
            )

    # Count total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        base_query
        .order_by(ErrorQuestion.last_error_at.desc())
        .offset(offset)
        .limit(limit)
    )
    errors = result.scalars().all()

    # Collect child names
    child_ids = list({e.child_id for e in errors})
    child_names: dict[int, str] = {}
    if child_ids:
        child_result = await db.execute(
            select(Child.id, Child.name).where(Child.id.in_(child_ids))
        )
        child_names = {row[0]: row[1] for row in child_result.all()}

    items = [
        ErrorQuestionResponse(
            id=e.id,
            submission_id=e.submission_id,
            child_id=e.child_id,
            child_name=child_names.get(e.child_id, ""),
            subject=e.subject,
            question_number=e.question_number,
            question_type=e.question_type,
            question_image_path=_build_image_url(request, e.question_image_path, parent.phone) or "",
            solution_note=e.solution_note,
            error_category=e.error_category,
            error_count=e.error_count,
            error_timestamps=e.error_timestamps
            if isinstance(e.error_timestamps, list)
            else [],
            is_manually_fixed=e.is_manually_fixed,
            last_error_at=e.last_error_at,
            created_at=e.created_at,
        )
        for e in errors
    ]

    return ErrorCollectionListResponse(items=items, total=total)


@router.post(
    "/error-collections/generate",
    response_model=GenerateSheetResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_error_sheet(
    body: GenerateSheetRequest,
    request: Request,
    parent: Annotated[Parent, Depends(get_parent)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate a practice sheet from error questions.

    Composites selected error question images into a single printable image
    with a title bar and answer spaces.
    """
    # Validate subject
    if body.subject not in VALID_SUBJECTS:
        raise HTTPException(
            status_code=422,
            detail=f"Field 'subject' must be one of: {', '.join(sorted(VALID_SUBJECTS))}.",
        )

    # Validate question_types
    if body.question_types:
        invalid_types = set(body.question_types) - VALID_QUESTION_TYPES
        if invalid_types:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid question types: {', '.join(sorted(invalid_types))}.",
            )

    # Verify child ownership
    child_result = await db.execute(
        select(Child).where(Child.id == body.child_id, Child.parent_id == parent.id)
    )
    child = child_result.scalar_one_or_none()
    if child is None:
        raise HTTPException(status_code=404, detail="Child not found")

    # Build query for error questions
    query = (
        select(ErrorQuestion)
        .where(ErrorQuestion.child_id == body.child_id)
        .where(ErrorQuestion.subject == body.subject)
    )

    if body.question_types:
        query = query.where(ErrorQuestion.question_type.in_(body.question_types))

    if body.from_date:
        try:
            dt = datetime.strptime(body.from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.where(ErrorQuestion.last_error_at >= dt)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="from_date must be YYYY-MM-DD format"
            )

    if body.to_date:
        try:
            dt = datetime.strptime(body.to_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            dt_end = dt + timedelta(days=1)
            query = query.where(ErrorQuestion.last_error_at < dt_end)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="to_date must be YYYY-MM-DD format"
            )

    query = query.order_by(ErrorQuestion.last_error_at.desc()).limit(body.count)
    result = await db.execute(query)
    errors = result.scalars().all()

    if not errors:
        raise HTTPException(
            status_code=400,
            detail="No error questions match the given filters.",
        )

    # Get child name for the title
    child_name = child.name

    # Generate the practice sheet
    sheet_path = compose_sheet(
        errors=errors,
        child_name=child_name,
        subject=body.subject,
    )

    # Build image URL
    image_url = _build_image_url(request, sheet_path, parent.phone)
    if image_url is None:
        image_url = ""

    return GenerateSheetResponse(
        image_url=image_url,
        question_count=len(errors),
    )
