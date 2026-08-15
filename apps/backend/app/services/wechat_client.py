"""WeChat mini-program auth client — exchanges wx.login code for openid.

Mirrors the httpx async style of `glm_client.py`. The `openid` returned here is
an internal login key: it is NEVER logged or exposed in any API response.
"""

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from backend root regardless of CWD (background tasks have no CWD)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"
WECHAT_APPID = os.getenv("WECHAT_APPID", "")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET", "")

# errcodes that mean the wx.login code is invalid / expired / already used.
INVALID_CODE_ERRCODES = {40029, 40163, 41008}


class WechatCodeError(Exception):
    """wx.login code is invalid or expired (maps to HTTP 401)."""


class WechatServiceError(Exception):
    """WeChat jscode2session failed — misconfigured or upstream unavailable."""


async def code2session(code: str) -> str:
    """Exchange a wx.login code for the WeChat openid.

    Returns the openid string. Raises WechatCodeError for an invalid/expired
    code, and WechatServiceError for any other failure (unconfigured appid,
    network error, unexpected WeChat response).
    """
    if not WECHAT_APPID or not WECHAT_APP_SECRET:
        raise WechatServiceError("WECHAT_APPID/WECHAT_APP_SECRET not configured")

    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_APP_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(JSCODE2SESSION_URL, params=params)
    except (httpx.TimeoutException, httpx.HTTPError) as e:
        raise WechatServiceError("jscode2session request failed") from e

    try:
        data = response.json()
    except ValueError as e:
        raise WechatServiceError("jscode2session returned non-JSON") from e

    errcode = data.get("errcode", 0)
    if errcode:
        if errcode in INVALID_CODE_ERRCODES:
            # Do not log openid/code — just the errcode.
            raise WechatCodeError(f"invalid wx.login code (errcode {errcode})")
        raise WechatServiceError(f"jscode2session error {errcode}")

    openid = data.get("openid")
    if not openid:
        raise WechatServiceError("jscode2session returned no openid")
    return openid
