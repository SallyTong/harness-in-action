"""GLM-4V API client for AI-powered homework grading."""

import base64
import json
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from backend root regardless of CWD (background tasks have no CWD)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

GLM_API_BASE = "https://open.bigmodel.cn/api/paas/v4"
GLM_API_KEY = os.getenv("GLM_API_KEY", "")
GLM_MODEL = os.getenv("GLM_MODEL", "glm-4v-flash")

SYSTEM_PROMPT_TEMPLATE = """你是一个专业的作业批改助手。请仔细分析这张{subject}试卷图片，逐题识别并批改。

对于每一道题，请返回以下信息：
- question_number: 题号（保持试卷上的原始编号，如"1"、"1a"、"II-3"）
- question_position: 题目在图片上的位置区域，使用百分比坐标（相对于图片宽度和高度的百分比，0-100之间的数字）
  - x: 左边缘（%）
  - y: 上边缘（%）
  - w: 宽度（%）
  - h: 高度（%）
- question_type: 题型分类，必须是以下之一：
  {subject}学科 — {question_types}
- is_correct: true表示作答正确，false表示作答错误
- solution_note: 如果is_correct为false，给出简短的解题思路或正确答案（中文，不超过150字）；如果is_correct为true，则为null
- error_category: 如果is_correct为false，归类错误类型，必须是以下之一：
  grammar（语法）、vocabulary（词汇）、spelling（拼写）、logic（逻辑）、calculation（计算）、careless（粗心）、comprehension（理解）；如果is_correct为true，则为null

以严格的JSON格式返回，格式如下：
{{"questions": [{{"question_number": "...", "question_position": {{"x": ..., "y": ..., "w": ..., "h": ...}}, "question_type": "...", "is_correct": true/false, "solution_note": "..." or null, "error_category": "..." or null}}]}}

注意：
- 坐标必须是0到100之间的数字，代表百分比
- 确保覆盖试卷上的所有题目
- 如果图片不清晰无法识别某道题，仍然返回该题但标记is_correct为false，solution_note说明"图片不清晰"
- 必须严格返回JSON，不要包含任何其他解释文字"""

SUBJECT_TYPES = {
    "english": "choice（选择题）、fill_blank（填空题）、reading（阅读理解）、composition（作文）",
    "math": "choice（选择题）、fill_blank（填空题）、calculation（计算题）、word_problem（应用题）",
}


class GLMError(Exception):
    """Raised when the GLM-4V API returns an error or fails to respond."""


def _encode_image(image_path: str) -> str:
    """Read an image file and return base64-encoded string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _get_max_tokens(model: str) -> int:
    """Return appropriate max_tokens for the given model.

    Free (flash) models are limited to 1024 output tokens.
    Paid models support up to 4096.
    """
    if "flash" in model.lower():
        return 1024
    return 4096


def _build_prompt(subject: str) -> str:
    qtypes = SUBJECT_TYPES.get(subject, SUBJECT_TYPES["english"])
    subject_name = "英语" if subject == "english" else "数学"
    return SYSTEM_PROMPT_TEMPLATE.format(subject=subject_name, question_types=qtypes)


async def grade_image(
    image_path: str,
    subject: str,
    api_key: str | None = None,
    model: str | None = None,
) -> dict:
    """Send an exam image to GLM-4V and return structured grading results.

    Returns a dict with keys:
        - questions: list of question dicts
        - token_usage: dict with prompt_tokens, completion_tokens, total_tokens
        - raw_response: the full API response JSON

    Raises GLMError on any failure.
    """
    key = api_key or os.getenv("GLM_API_KEY", "") or GLM_API_KEY
    mdl = model or GLM_MODEL

    if not key:
        raise GLMError("GLM_API_KEY environment variable is not set")

    image_b64 = _encode_image(image_path)
    system_prompt = _build_prompt(subject)

    payload = {
        "model": mdl,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {
                        "type": "text",
                        "text": "请按照系统提示分析这张试卷图片。",
                    },
                ],
            },
        ],
        "temperature": 0.1,
        "max_tokens": _get_max_tokens(mdl),
    }

    url = f"{GLM_API_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

            # Extract content from response
            choices = data.get("choices", [])
            if not choices:
                raise GLMError("GLM-4V returned no choices in response")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise GLMError("GLM-4V returned empty content")

            # Parse the JSON from the response
            # The model may wrap the JSON in markdown code fences
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
                if content.endswith("```"):
                    content = content[:-3].strip()
                if content.startswith("json\n"):
                    content = content[5:].strip()

            try:
                grading_result = json.loads(content)
            except json.JSONDecodeError as e:
                raise GLMError(
                    f"Failed to parse GLM-4V response as JSON: {e}\nContent: {content[:500]}"
                ) from e

            # Handle both formats: {"questions": [...]} and bare [...]
            if isinstance(grading_result, list):
                questions = grading_result
            elif isinstance(grading_result, dict):
                questions = grading_result.get("questions", [])
            else:
                raise GLMError(
                    f"Unexpected response type: {type(grading_result).__name__}"
                )

            if not isinstance(questions, list):
                raise GLMError(
                    f"Expected 'questions' to be a list, got {type(questions).__name__}"
                )

            token_usage = data.get("usage", {})
            if not token_usage:
                # Build from model's reported tokens if missing
                usage_info = data.get("usage", {})
                token_usage = {
                    "prompt_tokens": usage_info.get("prompt_tokens", 0),
                    "completion_tokens": usage_info.get("completion_tokens", 0),
                    "total_tokens": usage_info.get("total_tokens", 0),
                }

            return {
                "questions": questions,
                "token_usage": token_usage,
                "raw_response": data,
            }

        except (httpx.TimeoutException, httpx.HTTPError) as e:
            last_error = e
            if attempt == 0:
                logger.warning(
                    "GLM-4V API attempt %d failed: %s, retrying...", attempt + 1, e
                )
            else:
                logger.error("GLM-4V API attempt %d failed: %s", attempt + 1, e)
        except GLMError:
            raise
        except Exception as e:  # noqa: BLE001
            last_error = e
            logger.error("Unexpected error calling GLM-4V: %s", e)
            if attempt == 0:
                continue

    raise GLMError(
        f"GLM-4V API call failed after 2 attempts: {last_error}"
    ) from last_error
