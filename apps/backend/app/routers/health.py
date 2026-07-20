from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "ai-homework-grader", "version": "0.1.0"}
