from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_parent_with_default_children, get_db
from app.models.parent import Parent
from app.schemas.wechat import WechatLoginRequest, WechatLoginResponse
from app.services.wechat_client import (
    WechatCodeError,
    WechatServiceError,
    code2session,
)

router = APIRouter(prefix="/api", tags=["Auth"])


@router.post("/wechat-login", response_model=WechatLoginResponse)
async def wechat_login(
    body: WechatLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Exchange the wx.login code for openid (internal key, never logged/returned).
    try:
        openid = await code2session(body.code)
    except WechatCodeError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired wx.login code",
        ) from e
    except WechatServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="WeChat login service unavailable",
        ) from e

    # First login / rebind: a phone is provided, so (re)bind openid ↔ phone.
    if body.phone:
        by_openid = await db.execute(select(Parent).where(Parent.openid == openid))
        openid_parent = by_openid.scalar_one_or_none()

        by_phone = await db.execute(select(Parent).where(Parent.phone == body.phone))
        phone_parent = by_phone.scalar_one_or_none()

        if (
            openid_parent is not None
            and phone_parent is not None
            and openid_parent.id != phone_parent.id
        ):
            # openid was bound to phone A, now rebinding to phone B (two distinct
            # parent rows). Move only the login key: B gains the openid, A keeps its
            # own data but loses the openid login key. Data does NOT move between
            # rows here. (MVP trust model, no multi-device handling.)
            openid_parent.openid = None
            await db.flush()
            phone_parent.openid = openid
            await db.flush()
            return WechatLoginResponse(phone=body.phone)

        if openid_parent is not None:
            # Same openid rebinding to a phone that has no existing parent row
            # (phone not taken, or same row). We rename the existing row's phone to
            # body.phone, so this openid's historical data FOLLOWS it to the new
            # phone number. (Contrast the distinct-rows branch above, where data
            # stays put — see test_wechat_login_rebind_conflict_moves_openid_*.)
            openid_parent.phone = body.phone
            await db.flush()
            return WechatLoginResponse(phone=body.phone)

        if phone_parent is not None:
            # Existing Web/phone parent: bind openid to it (overwrites any old key).
            phone_parent.openid = openid
            await db.flush()
            return WechatLoginResponse(phone=body.phone)

        # Brand-new phone: create parent with default children, mirroring get_parent.
        await create_parent_with_default_children(db, phone=body.phone, openid=openid)
        return WechatLoginResponse(phone=body.phone)

    # Silent login: no phone — resolve the already-bound parent by openid.
    result = await db.execute(select(Parent).where(Parent.openid == openid))
    parent = result.scalar_one_or_none()
    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="openid not bound to a phone",
        )
    return WechatLoginResponse(phone=parent.phone)
