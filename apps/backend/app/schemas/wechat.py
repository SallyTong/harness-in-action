from pydantic import BaseModel, Field


class WechatLoginRequest(BaseModel):
    code: str = Field(
        min_length=1, max_length=128, description="wx.login() temporary code"
    )
    phone: str | None = Field(
        default=None,
        pattern=r"^\d{11}$",
        description="Optional. Parent phone to bind on first login.",
    )


class WechatLoginResponse(BaseModel):
    phone: str
