"""GLM-4V implementation of the VisionModel protocol.

Refactored from the former ``app/services/glm_client.py`` — external behavior is
unchanged (same prompt, payload, retry and token extraction).
"""

import base64
import logging
import os

from app.services.vision.base import (
    GradingResult,
    Subject,
    TokenUsage,
    VisionModelError,
    parse_questions,
    question_from_dict,
)
from app.services.vision.http import post_json_with_retry
from app.services.vision.prompts import build_prompt

logger = logging.getLogger(__name__)

GLM_API_BASE = "https://open.bigmodel.cn/api/paas/v4"
GLM_DEFAULT_MODEL = "glm-4v-flash"


class GLMError(VisionModelError):
    """Raised when the GLM-4V API returns an error or fails to respond."""


def _get_max_tokens(model: str) -> int:
    """Free (flash) models are limited to 1024 output tokens; paid ones get 4096."""
    if "flash" in model.lower():
        return 1024
    return 4096


class GLMVisionModel:
    """GLM-4V provider, selected when ``VISION_PROVIDER=glm`` (the default)."""

    provider = "glm"

    def __init__(self, model: str | None = None, api_key: str | None = None):
        self._model = model or os.getenv("GLM_MODEL", GLM_DEFAULT_MODEL)
        self._api_key = api_key

    async def grade(self, image: bytes, subject: Subject) -> GradingResult:
        key = self._api_key or os.getenv("GLM_API_KEY", "")
        if not key:
            raise GLMError("GLM_API_KEY environment variable is not set")

        image_b64 = base64.b64encode(image).decode("utf-8")
        system_prompt = build_prompt(subject)

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                        {"type": "text", "text": "请按照系统提示分析这张试卷图片。"},
                    ],
                },
            ],
            "temperature": 0.1,
            "max_tokens": _get_max_tokens(self._model),
        }

        url = f"{GLM_API_BASE}/chat/completions"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        data = await post_json_with_retry(
            url, payload, headers, label="GLM-4V", error_cls=GLMError
        )
        return self._to_result(data)

    def _to_result(self, data: dict) -> GradingResult:
        choices = data.get("choices", [])
        if not choices:
            raise GLMError("GLM-4V returned no choices in response")

        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise GLMError("GLM-4V returned empty content")

        questions = parse_questions(content)

        usage = data.get("usage") or {}
        prompt = usage.get("prompt_tokens", 0)
        completion = usage.get("completion_tokens", 0)
        total = usage.get("total_tokens", prompt + completion)

        return GradingResult(
            questions=[question_from_dict(q) for q in questions],
            raw_json=data,
            token_usage=TokenUsage(
                provider=self.provider,
                model=self._model,
                prompt_tokens=prompt,
                completion_tokens=completion,
                total_tokens=total,
            ),
        )
