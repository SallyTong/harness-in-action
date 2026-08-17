"""Bearer-JWT authentication dependency."""

from typing import Annotated

from fastapi import Header, HTTPException, status

from app.services.jwt import TokenError, decode_access_token


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_parent_id(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> int:
    """Resolve the authenticated parent id from the Bearer JWT.

    Verifies the signature and expiry and returns the `sub` claim as an int.
    Replaces the removed `get_parent(phone)` dependency: business endpoints no
    longer accept a phone in the query string or X-Parent-Phone header.
    """
    if not authorization:
        raise _unauthorized("Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Invalid Authorization header")

    try:
        return decode_access_token(token)
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc
