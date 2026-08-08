from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service="ai-homework-grader", version="0.1.0")
