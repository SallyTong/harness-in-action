"""Error collection endpoints: browse wrong answers and generate practice sheets."""

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.deps.auth import get_current_parent_id
from app.models.child import Child
from app.models.error_question import ErrorQuestion
from app.schemas.error_collections import (
    ErrorCollectionListResponse,
    ErrorQuestionResponse,
    GenerateSheetRequest,
    GenerateSheetResponse,
    SheetQuestionResponse,
)
from app.services.annotation import compose_sheet
from app.services.image_signing import build_signed_docx_url, build_signed_url, verify
from app.services.sheet_docx import DOCX_MEDIA_TYPE, build_sheet_docx
from app.services.sheet_text import assemble_sheet_questions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Error Collections"])

VALID_SUBJECTS = {"english", "math"}
VALID_QUESTION_TYPES = frozenset(
    {"choice", "fill_blank", "reading", "composition", "calculation", "word_problem"}
)

# Generated .docx sheets live alongside image sheets; the download endpoint
# resolves filenames strictly within this directory.
SHEET_DOCX_DIR = "data/images/sheets"

# Signed URLs only ever cover server-generated filenames ({uuid}.docx); this
# guard is defense-in-depth against path traversal.
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]+$")


@router.get("/error-collections", response_model=ErrorCollectionListResponse)
async def list_error_questions(
    request: Request,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
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
        .where(Child.parent_id == parent_id)
    )
    count_query = (
        select(func.count())
        .select_from(ErrorQuestion)
        .join(Child, ErrorQuestion.child_id == Child.id)
        .where(Child.parent_id == parent_id)
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
        base_query.order_by(ErrorQuestion.last_error_at.desc())
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
            question_image_path=build_signed_url(
                str(request.base_url), e.question_image_path
            )
            or "",
            question_text=e.question_text,
            question_latex=e.question_latex,
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
    parent_id: Annotated[int, Depends(get_current_parent_id)],
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
        select(Child).where(Child.id == body.child_id, Child.parent_id == parent_id)
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
            dt = datetime.strptime(body.from_date, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            query = query.where(ErrorQuestion.last_error_at >= dt)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="from_date must be YYYY-MM-DD format"
            )

    if body.to_date:
        try:
            dt = datetime.strptime(body.to_date, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            dt_end = dt + timedelta(days=1)
            query = query.where(ErrorQuestion.last_error_at < dt_end)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="to_date must be YYYY-MM-DD format"
            )

    if body.format == "text":
        # Random sample of transcribed question text (AD-25). Random order so
        # repeated sheets differ; `.limit` returns the actual count available.
        query = query.order_by(func.random()).limit(body.count)
        result = await db.execute(query)
        errors = result.scalars().all()

        if not errors:
            raise HTTPException(
                status_code=400,
                detail="No error questions match the given filters.",
            )

        entries = assemble_sheet_questions(errors)
        try:
            docx_path = build_sheet_docx(
                entries,
                child_name=child.name,
                subject=body.subject,
                output_dir=SHEET_DOCX_DIR,
            )
        except Exception:
            logger.exception("Failed to build text practice sheet")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate text practice sheet. Please try again later.",
            )

        docx_url = build_signed_docx_url(str(request.base_url), docx_path) or ""
        questions = [
            SheetQuestionResponse(
                question_number=e.question_number,
                question_type=e.question_type,
                subject=e.subject,
                question_text=e.question_text,
                question_latex=e.question_latex,
                question_image_path=build_signed_url(
                    str(request.base_url), e.question_image_path
                ),
                source_submission_id=e.source_submission_id,
            )
            for e in entries
        ]

        return GenerateSheetResponse(
            format="text",
            question_count=len(entries),
            questions=questions,
            docx_url=docx_url,
        )

    # image format (default, backward compatible)
    query = query.order_by(ErrorQuestion.last_error_at.desc()).limit(body.count)
    result = await db.execute(query)
    errors = result.scalars().all()

    if not errors:
        raise HTTPException(
            status_code=400,
            detail="No error questions match the given filters.",
        )

    # Generate the practice sheet image
    try:
        sheet_path = compose_sheet(
            errors=errors,
            child_name=child.name,
            subject=body.subject,
        )
    except Exception:
        logger.exception("Failed to compose practice sheet")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate practice sheet. Please try again later.",
        )

    # Build signed image URL
    image_url = build_signed_url(str(request.base_url), sheet_path) or ""

    return GenerateSheetResponse(
        format="image",
        image_url=image_url,
        question_count=len(errors),
    )


@router.get("/sheets/{filename}")
async def serve_sheet_docx(
    filename: str,
    token: str = Query(..., description="HMAC signature (base64url)"),
    expires: int = Query(..., description="Expiry as a Unix timestamp"),
):
    """Serve a generated .docx sheet via a signed URL.

    Authentication is via the same HMAC token + expiry scheme as image URLs
    (kind ``sheets``), so no Authorization header is required. Ownership was
    verified when the signed URL was issued.
    """
    if not SAFE_FILENAME.match(filename) or ".." in filename:
        raise HTTPException(status_code=404, detail="Invalid sheet filename")

    if not verify("sheets", filename, token, expires):
        raise HTTPException(
            status_code=403, detail="Invalid or expired sheet signature"
        )

    file_path = os.path.join(SHEET_DOCX_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Sheet file not found")

    return FileResponse(file_path, media_type=DOCX_MEDIA_TYPE, filename=filename)
