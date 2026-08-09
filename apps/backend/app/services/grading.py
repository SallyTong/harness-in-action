"""Grading pipeline orchestrator — the BackgroundTask that drives the full flow.

Called by the submissions router after accepting an upload. Runs
independently of the request lifecycle in its own DB session.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import get_db_session
from app.models.error_question import ErrorQuestion
from app.models.graded_question import GradedQuestion
from app.models.submission import Submission
from app.services.annotation import annotate_image, create_thumbnail, crop_question
from app.services.glm_client import grade_image

logger = logging.getLogger(__name__)

IMAGE_ORIGINALS = "data/images/originals"
IMAGE_ANNOTATED = "data/images/annotated"
IMAGE_THUMBNAILS = "data/images/thumbnails"
IMAGE_QUESTIONS = "data/images/questions"

# Valid ENUM values for question_type (must match DB enum: question_type_enum)
VALID_QUESTION_TYPES = frozenset({
    "choice",
    "fill_blank",
    "reading",
    "composition",
    "calculation",
    "word_problem",
})

# Valid error_category values
VALID_ERROR_CATEGORIES = frozenset({
    "grammar",
    "vocabulary",
    "spelling",
    "logic",
    "calculation",
    "careless",
    "comprehension",
})

QUESTION_NUMBER_MAX_LEN = 50


def _sanitize_question_number(raw: str) -> str:
    """Truncate and clean the question_number from the model response."""
    if not raw:
        return ""
    # Take only the first line or up to max length
    cleaned = raw.strip().split("\n")[0].strip()
    if len(cleaned) > QUESTION_NUMBER_MAX_LEN:
        cleaned = cleaned[:QUESTION_NUMBER_MAX_LEN - 3] + "..."
    return cleaned


def _sanitize_question_type(raw: str) -> str:
    """Map model output to a valid DB enum value for question_type."""
    if not raw:
        return "fill_blank"  # safe default
    raw_lower = raw.strip().lower()
    # Check if any valid type is a substring of the model's output
    for vtype in VALID_QUESTION_TYPES:
        if vtype in raw_lower:
            return vtype
    return "fill_blank"  # fallback


def _sanitize_error_category(raw: str | None) -> str | None:
    """Map model output to a valid error_category value."""
    if not raw:
        return None
    raw_lower = raw.strip().lower()
    for cat in VALID_ERROR_CATEGORIES:
        if cat in raw_lower:
            return cat
    return None  # unrecognized → None


async def _sync_error_questions(
    db, submission: Submission, graded_qs: list[GradedQuestion]
) -> None:
    """Sync ErrorQuestion records for incorrect answers.

    Must run in the same transaction as GradedQuestion insertion.
    For each incorrect GradedQuestion, UPSERT into ErrorQuestion.
    """
    now = datetime.now(timezone.utc)

    for gq in graded_qs:
        if gq.is_correct:
            continue

        # Check for existing record (same submission + question_number)
        existing = await db.execute(
            select(ErrorQuestion).where(
                ErrorQuestion.submission_id == submission.id,
                ErrorQuestion.question_number == gq.question_number,
            )
        )
        eq = existing.scalar_one_or_none()

        if eq:
            # Update existing
            eq.error_count += 1
            eq.error_timestamps = eq.error_timestamps + [now.isoformat()]
            eq.last_error_at = now
            eq.solution_note = gq.solution_note
            eq.error_category = gq.error_category
            eq.is_manually_fixed = gq.is_manually_fixed
            if gq.question_image_path:
                eq.question_image_path = gq.question_image_path
        else:
            # Create new
            eq = ErrorQuestion(
                submission_id=submission.id,
                child_id=submission.child_id,
                subject=submission.subject,
                question_number=gq.question_number,
                question_type=gq.question_type,
                question_image_path=gq.question_image_path or "",
                solution_note=gq.solution_note,
                error_category=gq.error_category,
                is_manually_fixed=gq.is_manually_fixed,
                error_count=1,
                error_timestamps=[now.isoformat()],
                last_error_at=now,
            )
            db.add(eq)


async def process_submission(submission_id: int) -> None:
    """Background task: grade a submission end-to-end.

    1. Set status=processing
    2. Call GLM-4V
    3. Store GradedQuestion records
    4. Annotate image + crop questions + create thumbnail
    5. Sync ErrorQuestion
    6. Set status=completed (or failed on error)
    """
    async with get_db_session() as db:
        result = await db.execute(
            select(Submission).where(Submission.id == submission_id)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            logger.error(
                "Submission %d not found for background processing", submission_id
            )
            return

        try:
            # Step 1: Set processing
            submission.status = "processing"
            await db.commit()

            # Step 2: Call GLM-4V
            image_path = submission.original_image_path
            glm_result = await grade_image(image_path, submission.subject)

            # Step 3: Store token usage + raw response
            submission.token_usage = glm_result["token_usage"]
            submission.grading_raw_json = glm_result["raw_response"]

            questions_data = glm_result["questions"]
            submission.total_questions = len(questions_data)

            correct = 0
            graded_qs: list[GradedQuestion] = []

            for qdata in questions_data:
                is_correct = qdata.get("is_correct", False)
                if is_correct:
                    correct += 1

                gq = GradedQuestion(
                    submission_id=submission.id,
                    question_number=_sanitize_question_number(
                        str(qdata.get("question_number", ""))
                    ),
                    question_position=qdata.get("question_position"),
                    question_type=_sanitize_question_type(
                        str(qdata.get("question_type", ""))
                    ),
                    is_correct=is_correct,
                    solution_note=qdata.get("solution_note"),
                    error_category=_sanitize_error_category(
                        qdata.get("error_category")
                    ),
                )
                db.add(gq)
                await db.flush()  # Get gq.id

                # Step 4: Crop question image if position is known
                if qdata.get("question_position"):
                    try:
                        safe_qnum = str(qdata["question_number"]).replace("/", "_")
                        crop_path = f"{IMAGE_QUESTIONS}/{submission.id}_{safe_qnum}.jpg"
                        crop_question(
                            image_path,
                            crop_path,
                            qdata["question_position"],
                        )
                        gq.question_image_path = crop_path
                    except Exception as e:  # noqa: BLE001
                        logger.warning(
                            "Failed to crop question %s: %s",
                            qdata.get("question_number"),
                            e,
                        )

                graded_qs.append(gq)

            submission.correct_count = correct

            # Step 4b: Annotate full image
            annotated_path = f"{IMAGE_ANNOTATED}/{submission.id}.jpg"
            annotate_image(image_path, annotated_path, questions_data)
            submission.annotated_image_path = annotated_path

            # Step 4c: Create thumbnail
            thumb_path = f"{IMAGE_THUMBNAILS}/{submission.id}.jpg"
            create_thumbnail(annotated_path, thumb_path)
            submission.thumbnail_path = thumb_path

            # Step 5: Sync ErrorQuestion
            await _sync_error_questions(db, submission, graded_qs)

            # Step 6: Mark completed
            submission.status = "completed"
            await db.commit()

            logger.info(
                "Submission %d grading complete: %d/%d correct",
                submission_id,
                correct,
                len(questions_data),
            )

        except Exception as e:
            logger.exception("Submission %d grading failed", submission_id)

            # Rollback the failed transaction and mark as failed in a fresh one
            await db.rollback()

            async with get_db_session() as retry_db:
                result = await retry_db.execute(
                    select(Submission).where(Submission.id == submission_id)
                )
                sub = result.scalar_one_or_none()
                if sub:
                    sub.status = "failed"
                    sub.grading_raw_json = {
                        "error": str(e),
                        "error_type": type(e).__name__,
                    }
                    await retry_db.commit()
