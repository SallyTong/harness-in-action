"""Submission endpoints: upload exam images and query grading results."""

import os
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_parent
from app.models.child import Child
from app.models.graded_question import GradedQuestion
from app.models.parent import Parent
from app.models.submission import Submission
from app.schemas.submissions import (
    GradedQuestionResponse,
    ScoreSummary,
    SubmissionAccepted,
    SubmissionResponse,
)
from app.services.grading import process_submission

router = APIRouter(prefix="/api", tags=["Submissions"])

IMAGE_ORIGINALS = "data/images/originals"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_SUBJECTS = {"english", "math"}

# JPEG magic bytes: FF D8 FF
JPEG_MAGIC = b"\xff\xd8\xff"
# PNG magic bytes: 89 50 4E 47
PNG_MAGIC = b"\x89PNG"


def _build_image_url(request: Request, rel_path: str | None) -> str | None:
    """Convert a relative image path to a full URL."""
    if not rel_path:
        return None
    base = str(request.base_url).rstrip("/")
    return f"{base}/{rel_path}"


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
    request: Request,
    parent: Annotated[Parent, Depends(get_parent)],
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
        select(Child).where(Child.id == child_id, Child.parent_id == parent.id)
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


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: int,
    request: Request,
    parent: Annotated[Parent, Depends(get_parent)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get submission detail — used for polling and history viewing.

    Returns full grading data when status is 'completed', basic fields otherwise.
    """
    # Ownership check
    result = await db.execute(
        select(Submission)
        .join(Child, Submission.child_id == Child.id)
        .where(Submission.id == submission_id, Child.parent_id == parent.id)
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
                question_image_path=_build_image_url(request, gq.question_image_path),
                question_type=gq.question_type,
                is_correct=gq.is_correct,
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
        thumbnail_url=_build_image_url(request, submission.thumbnail_path),
        created_at=submission.created_at,
        original_image_url=_build_image_url(request, submission.original_image_path)
        or "",
        annotated_image_url=_build_image_url(request, submission.annotated_image_path),
        total_questions=submission.total_questions,
        correct_count=submission.correct_count,
        token_usage=submission.token_usage,
        questions=questions,
        updated_at=submission.updated_at,
    )


@router.get("/images/{kind}/{filename}")
async def serve_image(
    kind: str,
    filename: str,
    request: Request,
    parent: Annotated[Parent, Depends(get_parent)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Serve an image file with ownership verification.

    The filename is '{submission_id}.jpg' or '{submission_id}_{qnum}.jpg'.
    Ownership is verified through the submission → child → parent chain.
    """
    allowed_kinds = {"originals", "annotated", "thumbnails", "questions"}
    if kind not in allowed_kinds:
        raise HTTPException(status_code=404, detail="Image kind not found")

    # Extract submission_id from filename
    submission_id_str = filename.split("_")[0]
    submission_id_str = submission_id_str.replace(".jpg", "")
    try:
        submission_id = int(submission_id_str)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid image filename")

    # Verify ownership
    await _get_owned_submission(submission_id, parent.id, db)

    file_path = f"data/images/{kind}/{filename}"
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(file_path, media_type="image/jpeg")
