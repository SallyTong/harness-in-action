"""Cost tracking and budget monitoring for vision model API calls.

Logs token consumption per grading attempt (including failed ones) and
provides aggregation for budget monitoring. MVP budget: 50 CNY/month.
"""

import logging

logger = logging.getLogger(__name__)

# Pricing (CNY per million tokens).
# GLM-4V: https://open.bigmodel.cn/pricing
# Qwen-VL (DashScope): https://help.aliyun.com/zh/model-studio/qwen-vl-model-billing-notice
PRICING_CNY_PER_1M = {
    "glm-4v-flash": {"prompt": 0, "completion": 0},  # Free
    "glm-4v-plus": {"prompt": 10, "completion": 10},
    "glm-4v": {"prompt": 50, "completion": 50},
    "qwen-vl-plus": {"prompt": 1.5, "completion": 4.5},
    "qwen-vl-max": {"prompt": 3, "completion": 9},
}

# Monthly budget cap (CNY) — from PRD
MONTHLY_BUDGET_CNY = 50.0


def calculate_cost(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> float:
    """Calculate cost in CNY for a single API call.

    Returns 0.0 for free models. Logs a warning if the call uses a paid model
    with non-zero cost.
    """
    pricing = PRICING_CNY_PER_1M.get(model)
    if pricing is None:
        logger.warning("Unknown model '%s', assuming free tier pricing", model)
        pricing = {"prompt": 0, "completion": 0}

    prompt_cost = (prompt_tokens / 1_000_000) * pricing["prompt"]
    completion_cost = (completion_tokens / 1_000_000) * pricing["completion"]
    total = round(prompt_cost + completion_cost, 6)

    return total


def log_token_usage(
    provider: str,
    model: str,
    token_usage: dict,
    subject: str,
    submission_id: int,
    success: bool,
) -> None:
    """Log token consumption for a single grading attempt.

    Called after every vision-model call, whether successful or not.
    This ensures we track wasted tokens from failed grading attempts.
    """
    prompt = token_usage.get("prompt_tokens", 0)
    completion = token_usage.get("completion_tokens", 0)
    total_tokens = token_usage.get("total_tokens", prompt + completion)
    cost = calculate_cost(model, prompt, completion)

    status = "success" if success else "failed"
    logger.info(
        "Vision cost | submission=%d subject=%s provider=%s model=%s status=%s "
        "prompt=%d completion=%d total=%d cost=%.6f CNY",
        submission_id,
        subject,
        provider,
        model,
        status,
        prompt,
        completion,
        total_tokens,
        cost,
    )
