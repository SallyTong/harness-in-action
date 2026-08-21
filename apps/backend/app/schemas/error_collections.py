from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator

VALID_SUBJECTS = {"english", "math"}
VALID_QUESTION_TYPES = frozenset(
    {"choice", "fill_blank", "reading", "composition", "calculation", "word_problem"}
)
VALID_FORMATS = {"text", "image"}


class ErrorQuestionResponse(BaseModel):
    id: int
    submission_id: int
    child_id: int
    child_name: str
    subject: str
    question_number: str
    question_type: str
    question_image_path: str
    question_text: str | None = None
    question_latex: str | None = None
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
    child_id: int = Field(ge=1)
    subject: str
    question_types: list[str] | None = None
    from_date: str | None = None
    to_date: str | None = None
    count: int = Field(default=10, ge=1, le=50)
    format: str = "image"

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        if v not in VALID_SUBJECTS:
            raise ValueError(
                f"Field 'subject' must be one of: {', '.join(sorted(VALID_SUBJECTS))}."
            )
        return v

    @field_validator("question_types")
    @classmethod
    def validate_question_types(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            invalid_types = set(v) - VALID_QUESTION_TYPES
            if invalid_types:
                raise ValueError(
                    f"Invalid question types: {', '.join(sorted(invalid_types))}."
                )
        return v

    @field_validator("from_date", "to_date")
    @classmethod
    def validate_date_format(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                datetime.strptime(v, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                raise ValueError("Date must be YYYY-MM-DD format")
        return v

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        if v not in VALID_FORMATS:
            raise ValueError(
                f"Field 'format' must be one of: {', '.join(sorted(VALID_FORMATS))}."
            )
        return v


class SheetQuestionResponse(BaseModel):
    question_number: str
    question_type: str
    subject: str
    question_text: str | None = None
    question_latex: str | None = None
    question_image_path: str | None = None
    source_submission_id: int


class GenerateSheetResponse(BaseModel):
    format: str
    question_count: int
    image_url: str | None = None
    questions: list[SheetQuestionResponse] | None = None
    docx_url: str | None = None
