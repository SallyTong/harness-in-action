"""Submission endpoints: upload exam images and query grading results."""

import os
import re
from datetime import datetime, timezone
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.deps.auth import get_current_parent_id
from app.models.child import Child
from app.models.error_question import ErrorQuestion
from app.models.graded_question import GradedQuestion
from app.models.submission import Submission
from app.schemas.submissions import (
    FixQuestionRequest,
    FixQuestionResponse,
    GradedQuestionResponse,
    ScoreSummary,
    SubmissionAccepted,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionSummary,
)
from app.services.grading import process_submission
from app.services.image_signing import (
    IMAGE_KINDS,
    build_signed_url,
)
from app.services.image_signing import (
    verify as verify_image_signature,
)

router = APIRouter(prefix="/api", tags=["Submissions"])

IMAGE_ORIGINALS = "data/images/originals"
IMAGE_ROOT = "data/images"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_SUBJECTS = {"english", "math"}

# JPEG magic bytes: FF D8 FF
JPEG_MAGIC = b"\xff\xd8\xff"
# PNG magic bytes: 89 50 4E 47
PNG_MAGIC = b"\x89PNG"

# Signed URLs only ever cover server-generated filenames ({id}.jpg, {id}_{n}.jpg,
# {uuid}.jpg); this guard is defense-in-depth against path traversal.
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]+$")


async def _get_owned_submission(
    submission_id: int, parent_id: int, db: AsyncSession
) -> Submission:
    """Fetch a submission by ID with ownership check (trace FK to Parent)."""
    result = await db.execute(
        select(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Submission.id == submission_id, Child.parent_id == parent_id)
    )
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.post(
    "/submissions",
    response_model=SubmissionAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_submission(
    background_tasks: BackgroundTasks,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    image: Annotated[UploadFile, File()],
    subject: Annotated[str, Form()],
    child_id: Annotated[int, Form()],
):
    """Upload an exam image for async AI grading.

    Returns immediately with 202 + submission_id. The grading process
    runs in a background task. Frontend polls GET /api/submissions/{id}
    every 2 seconds until status is completed or failed.
    """
    # Validate subject
    if subject not in ALLOWED_SUBJECTS:
        raise HTTPException(
            status_code=422,
            detail=f"Field 'subject' must be one of: {', '.join(sorted(ALLOWED_SUBJECTS))}.",
        )

    # Validate child ownership
    child_result = await db.execute(
        select(Child).where(Child.id == child_id, Child.parent_id == parent_id)
    )
    child = child_result.scalar_one_or_none()
    if child is None:
        raise HTTPException(status_code=404, detail="Child not found")

    # Read file content
    content = await image.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 20MB.",
        )

    # Validate file type by magic bytes
    if not content.startswith((JPEG_MAGIC, PNG_MAGIC)):
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Only JPEG and PNG are supported.",
        )

    # Create Submission record
    submission = Submission(
        child_id=child_id,
        subject=subject,
        status="pending",
        original_image_path="",  # Will be set after we get the ID
    )
    db.add(submission)
    await db.flush()
    await db.refresh(submission)

    # Save original image
    os.makedirs(IMAGE_ORIGINALS, exist_ok=True)
    orig_path = f"{IMAGE_ORIGINALS}/{submission.id}.jpg"
    with open(orig_path, "wb") as f:  # noqa: ASYNC230
        f.write(content)
    submission.original_image_path = orig_path
    await db.flush()

    # Launch background grading
    background_tasks.add_task(process_submission, submission.id)

    return SubmissionAccepted(submission_id=submission.id, status="pending")


@router.get("/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    request: Request,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    child_id: int | None = None,
    subject: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List past submissions for the current parent with pagination.

    Filters: child_id, subject. Sorted by created_at descending.
    """
    # Base query: only submissions owned by this parent
    base_query = (
        select(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Child.parent_id == parent_id)
    )
    count_query = (
        select(func.count())
        .select_from(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Child.parent_id == parent_id)
    )

    if child_id is not None:
        base_query = base_query.where(Submission.child_id == child_id)
        count_query = count_query.where(Submission.child_id == child_id)

    if subject is not None:
        base_query = base_query.where(Submission.subject == subject)
        count_query = count_query.where(Submission.subject == subject)

    # Count total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        base_query.order_by(Submission.created_at.desc()).offset(offset).limit(limit)
    )
    submissions = result.scalars().all()

    # Collect child names in one query (more efficient than N queries)
    child_ids = list({s.child_id for s in submissions})
    child_names: dict[int, str] = {}
    if child_ids:
        child_result = await db.execute(
            select(Child.id, Child.name).where(Child.id.in_(child_ids))
        )
        child_names = {row[0]: row[1] for row in child_result.all()}

    items: list[SubmissionSummary] = []
    for s in submissions:
        score = None
        if s.status == "completed" and s.total_questions:
            score = ScoreSummary(
                correct=s.correct_count or 0,
                total=s.total_questions,
            )
        items.append(
            SubmissionSummary(
                id=s.id,
                child_id=s.child_id,
                child_name=child_names.get(s.child_id, ""),
                subject=s.subject,
                status=s.status,
                score=score,
                thumbnail_url=build_signed_url(str(request.base_url), s.thumbnail_path),
                created_at=s.created_at,
            )
        )

    return SubmissionListResponse(items=items, total=total)


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: int,
    request: Request,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get submission detail — used for polling and history viewing.

    Returns full grading data when status is 'completed', basic fields otherwise.
    """
    # Ownership check
    result = await db.execute(
        select(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Submission.id == submission_id, Child.parent_id == parent_id)
    )
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Build base response
    child_name = ""
    child_result = await db.execute(
        select(Child.name).where(Child.id == submission.child_id)
    )
    child_name = child_result.scalar_one_or_none() or ""

    score = None
    questions = None

    if submission.status == "completed":
        if submission.correct_count is not None and submission.total_questions:
            score = ScoreSummary(
                correct=submission.correct_count,
                total=submission.total_questions,
            )

        # Load graded questions
        gq_result = await db.execute(
            select(GradedQuestion)
            .where(GradedQuestion.submission_id == submission.id)
            .order_by(GradedQuestion.id)
        )
        graded_qs = gq_result.scalars().all()
        questions = [
            GradedQuestionResponse(
                id=gq.id,
                question_number=gq.question_number,
                question_position=gq.question_position,
                question_image_path=build_signed_url(
                    str(request.base_url), gq.question_image_path
                ),
                question_type=gq.question_type,
                is_correct=gq.is_correct,
                question_text=gq.question_text,
                question_latex=gq.question_latex,
                solution_note=gq.solution_note,
                error_category=gq.error_category,
                is_manually_fixed=gq.is_manually_fixed,
            )
            for gq in graded_qs
        ]

    return SubmissionResponse(
        id=submission.id,
        child_id=submission.child_id,
        child_name=child_name,
        subject=submission.subject,
        status=submission.status,
        score=score,
        thumbnail_url=build_signed_url(
            str(request.base_url), submission.thumbnail_path
        ),
        created_at=submission.created_at,
        original_image_url=build_signed_url(
            str(request.base_url), submission.original_image_path
        )
        or "",
        annotated_image_url=build_signed_url(
            str(request.base_url), submission.annotated_image_path
        ),
        total_questions=submission.total_questions,
        correct_count=submission.correct_count,
        token_usage=submission.token_usage,
        questions=questions,
        updated_at=submission.updated_at,
    )


@router.patch(
    "/submissions/{submission_id}/questions/{question_id}",
    response_model=FixQuestionResponse,
)
async def fix_question_grade(
    submission_id: int,
    question_id: int,
    body: FixQuestionRequest,
    request: Request,
    parent_id: Annotated[int, Depends(get_current_parent_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manually override a question's grading result.

    Updates GradedQuestion.is_correct, sets is_manually_fixed=True,
    recalculates Submission.correct_count, and syncs ErrorQuestion.
    All in one transaction.
    """
    # 1. Verify ownership: Submission → Child → Parent
    sub_result = await db.execute(
        select(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Submission.id == submission_id, Child.parent_id == parent_id)
    )
    submission = sub_result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Only allow correction on completed submissions
    if submission.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Can only correct questions on completed submissions",
        )

    # 2. Load the GradedQuestion, verify it belongs to this submission
    gq_result = await db.execute(
        select(GradedQuestion).where(
            GradedQuestion.id == question_id,
            GradedQuestion.submission_id == submission_id,
        )
    )
    gq = gq_result.scalar_one_or_none()
    if gq is None:
        raise HTTPException(status_code=404, detail="Question not found")

    old_is_correct = gq.is_correct
    new_is_correct = body.is_correct

    def _question_response() -> GradedQuestionResponse:
        return GradedQuestionResponse(
            id=gq.id,
            question_number=gq.question_number,
            question_position=gq.question_position,
            question_image_path=build_signed_url(
                str(request.base_url), gq.question_image_path
            ),
            question_type=gq.question_type,
            is_correct=gq.is_correct,
            question_text=gq.question_text,
            question_latex=gq.question_latex,
            solution_note=gq.solution_note,
            error_category=gq.error_category,
            is_manually_fixed=gq.is_manually_fixed,
        )

    # No change — return current state
    if old_is_correct == new_is_correct:
        return FixQuestionResponse(
            question=_question_response(),
            new_score=ScoreSummary(
                correct=submission.correct_count or 0,
                total=submission.total_questions or 0,
            ),
        )

    # 3. Update the question
    gq.is_correct = new_is_correct
    gq.is_manually_fixed = True

    # 4. Recalculate correct_count
    count_result = await db.execute(
        select(func.count())
        .select_from(GradedQuestion)
        .where(
            GradedQuestion.submission_id == submission_id,
            GradedQuestion.is_correct == True,
        )
    )
    new_correct = count_result.scalar() or 0
    submission.correct_count = new_correct

    # 5. Sync ErrorQuestion
    now = datetime.now(timezone.utc)

    if old_is_correct and not new_is_correct:
        # Correct → Wrong: add to ErrorQuestion
        eq_result = await db.execute(
            select(ErrorQuestion).where(
                ErrorQuestion.submission_id == submission_id,
                ErrorQuestion.question_number == gq.question_number,
            )
        )
        eq = eq_result.scalar_one_or_none()

        if eq:
            eq.error_count += 1
            eq.error_timestamps = eq.error_timestamps + [now.isoformat()]
            eq.last_error_at = now
            eq.solution_note = gq.solution_note
            eq.error_category = gq.error_category
            eq.question_text = gq.question_text
            eq.question_latex = gq.question_latex
            eq.is_manually_fixed = True
        else:
            eq = ErrorQuestion(
                submission_id=submission.id,
                child_id=submission.child_id,
                subject=submission.subject,
                question_number=gq.question_number,
                question_type=gq.question_type,
                question_image_path=gq.question_image_path or "",
                solution_note=gq.solution_note,
                error_category=gq.error_category,
                question_text=gq.question_text,
                question_latex=gq.question_latex,
                is_manually_fixed=True,
                error_count=1,
                error_timestamps=[now.isoformat()],
                last_error_at=now,
            )
            db.add(eq)

    elif not old_is_correct and new_is_correct:
        # Wrong → Correct: remove from ErrorQuestion
        eq_result = await db.execute(
            select(ErrorQuestion).where(
                ErrorQuestion.submission_id == submission_id,
                ErrorQuestion.question_number == gq.question_number,
            )
        )
        eq = eq_result.scalar_one_or_none()
        if eq:
            await db.delete(eq)

    await db.flush()

    return FixQuestionResponse(
        question=_question_response(),
        new_score=ScoreSummary(
            correct=new_correct,
            total=submission.total_questions or 0,
        ),
    )


@router.get("/images/{kind}/{filename}")
async def serve_image(
    kind: str,
    filename: str,
    token: str = Query(..., description="HMAC signature (base64url)"),
    expires: int = Query(..., description="Expiry as a Unix timestamp"),
):
    """Serve an image file via a signed URL.

    Authentication is via an HMAC token + expiry in the query string (not the
    Authorization header, since <img>/<image> tags cannot send headers). The
    token is bound to kind+filename+expires, so it cannot be reused for another
    file. Ownership was verified when the URL was issued.
    """
    if kind not in IMAGE_KINDS:
        raise HTTPException(status_code=404, detail="Image kind not found")

    if not SAFE_FILENAME.match(filename) or ".." in filename:
        raise HTTPException(status_code=404, detail="Invalid image filename")

    if not verify_image_signature(kind, filename, token, expires):
        raise HTTPException(
            status_code=403, detail="Invalid or expired image signature"
        )

    file_path = os.path.join(IMAGE_ROOT, kind, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(file_path, media_type="image/jpeg")
