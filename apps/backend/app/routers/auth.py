"""Auth endpoints: SMS verification-code login issuing a JWT."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_parent_with_default_children, get_db
from app.models.parent import Parent
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SendCodeRequest,
    SendCodeResponse,
)
from app.services import sms
from app.services.jwt import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/send-code", response_model=SendCodeResponse)
async def send_verification_code(body: SendCodeRequest):
    """Send a 6-digit SMS code. Rate-limited to one send per 60s per phone."""
    try:
        retry_after = await sms.send_code(body.phone)
    except sms.SmsRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except sms.SmsDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="SMS service unavailable",
        ) from exc
    return SendCodeResponse(retry_after=retry_after)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """Verify the SMS code and issue a JWT (sub = parent id).

    First login auto-creates the Parent (phone UNIQUE) with default children.
    This is the primary login path for both Web and mini-program.
    """
    if not sms.verify_code(body.phone, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code",
        )

    result = await db.execute(select(Parent).where(Parent.phone == body.phone))
    parent = result.scalar_one_or_none()
    if parent is None:
        parent = await create_parent_with_default_children(db, phone=body.phone)

    token, expires_at = create_access_token(parent.id)
    return LoginResponse(
        token=token,
        token_type="Bearer",
        expires_at=expires_at,
        user_id=parent.id,
    )
