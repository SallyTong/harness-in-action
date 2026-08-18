"""Shared HTTP helper for vision providers (POST + one retry)."""

import logging

import httpx

from app.services.vision.base import VisionModelError

logger = logging.getLogger(__name__)


async def post_json_with_retry(
    url: str,
    payload: dict,
    headers: dict,
    *,
    label: str,
    error_cls: type[VisionModelError],
    timeout: float = 30.0,
) -> dict:
    """POST JSON to a provider endpoint with one retry on transient errors.

    Returns the parsed JSON body on success. Raises ``error_cls`` after two
    failed attempts. ``label`` only feeds log messages so each provider's lines
    are recognizable.
    """
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except (httpx.TimeoutException, httpx.HTTPError) as e:
            last_error = e
            if attempt == 0:
                logger.warning(
                    "%s API attempt %d failed: %s, retrying...", label, attempt + 1, e
                )
            else:
                logger.error("%s API attempt %d failed: %s", label, attempt + 1, e)
        except Exception as e:  # noqa: BLE001
            last_error = e
            logger.error("Unexpected error calling %s: %s", label, e)
            if attempt == 0:
                continue

    raise error_cls(
        f"{label} API call failed after 2 attempts: {last_error}"
    ) from last_error
