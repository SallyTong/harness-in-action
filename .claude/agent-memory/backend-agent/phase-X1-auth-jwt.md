# Phase X1 — Auth Login (SMS + JWT, de-phone, signed URLs, wechat-login removed)

**Status:** ✅ Complete (2026-08-16). Contract `contracts/openapi.yaml` v0.2.0.
**Scope:** Replace the phone trust model with SMS + JWT; remove phone from business
endpoints; signed-URL image auth; remove `POST /api/wechat-login`.

## What was built

- `app/routers/auth.py` — `POST /api/auth/send-code` (200 `{retry_after}` / 429 rate-limited / 502 SMS down) and `POST /api/auth/login` (verify code → issue JWT; first login auto-creates Parent + 2 default children).
- `app/deps/auth.py` — `get_current_parent_id(Authorization)` verifies Bearer JWT → returns `sub` as int; replaces the removed `get_parent(phone)`.
- `app/services/jwt.py` — HS256, `sub`=parent id (stringified), `exp`=30d, `JWT_SECRET` read at call time; `TokenError` on any failure.
- `app/services/image_signing.py` — HMAC-SHA256 `sign`/`verify` + `build_signed_url(base_url, rel_path)`, default TTL 3600s, `IMAGE_SIGNING_SECRET`; normalizes Windows backslashes.
- `app/services/sms.py` — Aliyun SMS (RPC Signature V1), 6-digit code, 5-min TTL + 60s resend throttle, in-memory store; `SmsRateLimitError` / `SmsDeliveryError`.
- `app/schemas/auth.py` — `SendCodeRequest/Response`, `LoginRequest/Response`.
- `app/dependencies.py` — `create_parent_with_default_children(db, phone)` shared by login; `get_parent(phone)` removed.

## What was removed

- `app/routers/wechat.py`, `app/schemas/wechat.py`, `app/services/wechat_client.py`, `tests/test_wechat.py`.
- `WECHAT_APPID` / `WECHAT_APP_SECRET` env vars no longer used. `Parent.openid` column retained (forward-only, no drop) but no longer read/written.

## New env vars

`JWT_SECRET`, `IMAGE_SIGNING_SECRET`, `SMS_ACCESS_KEY_ID`, `SMS_ACCESS_KEY_SECRET`, `SMS_SIGN_NAME`, `SMS_TEMPLATE_CODE`.

## Tests

`tests/test_auth.py` (send-code 200/429/502; login 200/401/first-registration), `tests/test_image_signing.py` (valid/expired/tampered), plus updated `conftest.py` and endpoint tests for Bearer auth (no token→401, wrong token→401, cross-user→404).

## Known limitations / accepted debt

1. Pure JWT — no revocation; token valid until `exp` (30d). Accepted for family use (AD-18).
2. SMS codes in-memory — lost on restart; single-node only (matches `rate_limiter.py`).
3. Image signed URLs bearer-able for their TTL (1h).

## Contract deviations

None — implemented against `contracts/openapi.yaml` v0.2.0.
