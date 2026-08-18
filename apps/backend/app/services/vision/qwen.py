"""Qwen-VL implementation of the VisionModel protocol.

Calls Aliyun Bailian's OpenAI-compatible endpoint with the same prompt and
output schema as GLM-4V, so switching providers is transparent to downstream
consumers (AD-21).
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

QWEN_API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_DEFAULT_MODEL = "qwen-vl-max"


class QwenError(VisionModelError):
    """Raised when the Qwen-VL API returns an error or fails to respond."""


class QwenVisionModel:
    """Qwen-VL provider, selected when ``VISION_PROVIDER=qwen``."""

    provider = "qwen"

    def __init__(self, model: str | None = None, api_key: str | None = None):
        self._model = model or QWEN_DEFAULT_MODEL
        self._api_key = api_key

    async def grade(self, image: bytes, subject: Subject) -> GradingResult:
        key = self._api_key or os.getenv("QWEN_API_KEY", "")
        if not key:
            raise QwenError("QWEN_API_KEY environment variable is not set")

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
            "max_tokens": 4096,
        }

        url = f"{QWEN_API_BASE}/chat/completions"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        data = await post_json_with_retry(
            url, payload, headers, label="Qwen-VL", error_cls=QwenError
        )
        return self._to_result(data)

    def _to_result(self, data: dict) -> GradingResult:
        choices = data.get("choices", [])
        if not choices:
            raise QwenError("Qwen-VL returned no choices in response")

        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise QwenError("Qwen-VL returned empty content")

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
