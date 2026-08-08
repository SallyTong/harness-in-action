from datetime import datetime

from pydantic import BaseModel


class SubmissionAccepted(BaseModel):
    submission_id: int
    status: str


class ScoreSummary(BaseModel):
    correct: int
    total: int


class GradedQuestionResponse(BaseModel):
    id: int
    question_number: str
    question_position: dict | None = None
    question_image_path: str | None = None
    question_type: str
    is_correct: bool
    solution_note: str | None = None
    error_category: str | None = None
    is_manually_fixed: bool = False

    model_config = {"from_attributes": True}


class SubmissionSummary(BaseModel):
    id: int
    child_id: int
    child_name: str
    subject: str
    status: str
    score: ScoreSummary | None = None
    thumbnail_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    id: int
    child_id: int
    child_name: str
    subject: str
    status: str
    score: ScoreSummary | None = None
    thumbnail_url: str | None = None
    created_at: datetime
    original_image_url: str
    annotated_image_url: str | None = None
    total_questions: int | None = None
    correct_count: int | None = None
    token_usage: dict | None = None
    questions: list[GradedQuestionResponse] | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
