from datetime import datetime

from pydantic import BaseModel, Field


class SendCodeRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{11}$")


class SendCodeResponse(BaseModel):
    retry_after: int


class LoginRequest(BaseModel):
    phone: str = Field(pattern=r"^\d{11}$")
    code: str = Field(pattern=r"^\d{6}$")


class LoginResponse(BaseModel):
    token: str
    token_type: str
    expires_at: datetime
    user_id: int
