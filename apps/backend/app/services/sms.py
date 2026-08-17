"""Aliyun SMS verification-code service.

Sends a 6-digit code via Aliyun SMS and stores it in-memory with a 5-minute
TTL and a 60-second resend throttle per phone. In-memory storage is chosen for
the single-node MVP (matching `rate_limiter.py`); the code itself is never
returned in any response and never logged.

The actual Aliyun HTTP call lives in `_send_sms_via_aliyun` so tests can mock
the transport without real credentials or quota.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

# Load .env from backend root regardless of CWD (background tasks have no CWD)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

SMS_ACCESS_KEY_ID = os.getenv("SMS_ACCESS_KEY_ID", "")
SMS_ACCESS_KEY_SECRET = os.getenv("SMS_ACCESS_KEY_SECRET", "")
SMS_SIGN_NAME = os.getenv("SMS_SIGN_NAME", "")
SMS_TEMPLATE_CODE = os.getenv("SMS_TEMPLATE_CODE", "")

SMS_ENDPOINT = "https://dysmsapi.aliyuncs.com/"
SMS_API_VERSION = "2017-05-25"

CODE_TTL_SECONDS = 300  # code valid for 5 minutes
RESEND_INTERVAL_SECONDS = 60  # 60s between sends per phone

# In-memory store: {phone: {"code": str, "expires_at": float, "sent_at": float}}
_codes: dict[str, dict] = {}


class SmsRateLimitError(Exception):
    """A code was requested too soon after the previous send."""

    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Too many requests, retry in {retry_after}s")


class SmsDeliveryError(Exception):
    """SMS delivery failed — misconfigured or upstream unavailable."""


def _now() -> float:
    return time.time()


def _generate_code() -> str:
    """Generate a 6-digit verification code (zero-padded)."""
    return f"{secrets.randbelow(1_000_000):06d}"


async def send_code(phone: str) -> int:
    """Generate, send, and store a code for `phone`.

    Returns the fixed resend interval (seconds). Raises SmsRateLimitError if a
    code was sent for this phone less than 60 seconds ago.
    """
    entry = _codes.get(phone)
    if entry is not None:
        elapsed = _now() - entry["sent_at"]
        if elapsed < RESEND_INTERVAL_SECONDS:
            raise SmsRateLimitError(
                retry_after=int(RESEND_INTERVAL_SECONDS - elapsed) + 1
            )

    code = _generate_code()
    await _send_sms_via_aliyun(phone, code)

    _codes[phone] = {
        "code": code,
        "expires_at": _now() + CODE_TTL_SECONDS,
        "sent_at": _now(),
    }
    return RESEND_INTERVAL_SECONDS


def verify_code(phone: str, code: str) -> bool:
    """Verify a code for `phone`. Consumes the code on success (one-time use)."""
    entry = _codes.get(phone)
    if entry is None:
        return False
    if _now() > entry["expires_at"]:
        _codes.pop(phone, None)
        return False
    if not hmac.compare_digest(str(entry["code"]), str(code)):
        return False
    _codes.pop(phone, None)
    return True


def _percent_encode(value: str) -> str:
    """RFC 3986 percent-encoding used by Aliyun RPC signing (encodes '/' too)."""
    return quote(str(value), safe="")


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_canonical_query(params: dict) -> str:
    return "&".join(
        f"{_percent_encode(k)}={_percent_encode(params[k])}" for k in sorted(params)
    )


async def _send_sms_via_aliyun(phone: str, code: str) -> None:
    """Send `code` to `phone` via Aliyun SMS (RPC Signature V1, SendSms)."""
    if not all(
        [SMS_ACCESS_KEY_ID, SMS_ACCESS_KEY_SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE]
    ):
        raise SmsDeliveryError(
            "SMS not configured "
            "(SMS_ACCESS_KEY_ID/SECRET, SMS_SIGN_NAME, SMS_TEMPLATE_CODE)"
        )

    params = {
        "AccessKeyId": SMS_ACCESS_KEY_ID,
        "Action": "SendSms",
        "Format": "JSON",
        "PhoneNumbers": phone,
        "SignName": SMS_SIGN_NAME,
        "TemplateCode": SMS_TEMPLATE_CODE,
        "TemplateParam": json.dumps({"code": code}),
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": str(uuid.uuid4()),
        "SignatureVersion": "1.0",
        "Timestamp": _utc_timestamp(),
        "Version": SMS_API_VERSION,
    }

    canonical = _build_canonical_query(params)
    string_to_sign = "GET&%2F&" + _percent_encode(canonical)
    key = (SMS_ACCESS_KEY_SECRET + "&").encode("utf-8")
    signature = base64.b64encode(
        hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")
    params["Signature"] = signature

    url = f"{SMS_ENDPOINT}?{_build_canonical_query(params)}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SmsDeliveryError(f"SMS request failed: {exc}") from exc

    if data.get("Code") != "OK":
        raise SmsDeliveryError(
            f"SendSms failed: {data.get('Code')} {data.get('Message', '')}"
        )
