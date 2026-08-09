from datetime import datetime

from pydantic import BaseModel, Field


class ErrorQuestionResponse(BaseModel):
    id: int
    submission_id: int
    child_id: int
    child_name: str
    subject: str
    question_number: str
    question_type: str
    question_image_path: str
    solution_note: str | None = None
    error_category: str | None = None
    error_count: int
    error_timestamps: list[str]
    is_manually_fixed: bool = False
    last_error_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorCollectionListResponse(BaseModel):
    items: list[ErrorQuestionResponse]
    total: int


class GenerateSheetRequest(BaseModel):
    child_id: int
    subject: str  # "english" | "math"
    question_types: list[str] | None = None
    from_date: str | None = None  # YYYY-MM-DD
    to_date: str | None = None
    count: int = Field(default=10, ge=1, le=50)


class GenerateSheetResponse(BaseModel):
    image_url: str
    question_count: int
