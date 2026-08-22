from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DEFAULT_GRADE = "五年级"

# Contract (openapi.yaml v0.2.0): grade is a string enum over the six primary
# school grades. Stored as VARCHAR(20) at the DB layer.
Grade = Literal["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]


class ChildResponse(BaseModel):
    id: int
    name: str
    grade: str
    note: str | None
    avatar: str | None
    submission_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateChildRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    grade: Grade = Field(default=DEFAULT_GRADE)
    note: str | None = Field(default=None, max_length=200)


class UpdateChildRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    grade: Grade = Field(default=DEFAULT_GRADE)
    note: str | None = Field(default=None, max_length=200)
