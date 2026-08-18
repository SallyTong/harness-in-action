"""Provider selection for the vision model (AD-21).

Chooses the concrete VisionModel implementation from env vars:
- ``VISION_PROVIDER``: ``glm`` (default) or ``qwen``
- ``VISION_MODEL``:    model id override (default ``glm-4v-flash`` / ``qwen-vl-max``)
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from app.services.vision.base import VisionModel

# Load .env from backend root regardless of CWD (background tasks have no CWD)
_env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

DEFAULT_MODELS = {
    "glm": "glm-4v-flash",
    "qwen": "qwen-vl-max",
}

VALID_PROVIDERS = frozenset(DEFAULT_MODELS)


def _resolve_model(provider: str) -> str:
    """Resolve the model id for ``provider``, honoring overrides."""
    model = os.getenv("VISION_MODEL")
    if model:
        return model.strip()
    if provider == "glm":
        # Keep supporting the legacy GLM_MODEL env var.
        legacy = os.getenv("GLM_MODEL")
        if legacy:
            return legacy.strip()
    return DEFAULT_MODELS[provider]


def get_vision_model() -> VisionModel:
    """Return the configured vision model instance.

    Reads env at call time so tests and runtime config changes take effect
    without a process restart.
    """
    provider = (os.getenv("VISION_PROVIDER") or "glm").strip().lower()
    if provider not in VALID_PROVIDERS:
        logger.warning("Unknown VISION_PROVIDER '%s', falling back to glm", provider)
        provider = "glm"

    model = _resolve_model(provider)

    if provider == "qwen":
        from app.services.vision.qwen import QwenVisionModel

        return QwenVisionModel(model=model)

    from app.services.vision.glm import GLMVisionModel

    return GLMVisionModel(model=model)
